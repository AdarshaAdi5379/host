from __future__ import annotations

import tempfile
from pathlib import Path

from django.contrib.auth.models import User
from django.core.management import call_command
from django.test import TestCase
from django.test.utils import override_settings
from django.utils import timezone

from sites.compute_service import ComputeService
from sites.management.commands.run_compute_worker import Command as WorkerCommand
from sites.models import ComputeFlavor, ComputeImage, ComputeInstance, ComputeOperation, SSHKeyPair


SSH_KEY = (
    "ssh-ed25519 "
    "AAAAC3NzaC1lZDI1NTE5AAAAIF5u0OQ4X7m2c3hG2f0qM4G4YhYzu3PV6PvJEa3TBUnV "
    "owner@example"
)


class _FailingCreateDriver:
    def __init__(self):
        self.domain_created = False
        self.destroy_called = False
        self.undefine_called = False

    def create_overlay_disk(self, base_image_path: str, disk_path: str, disk_gb: int):
        path = Path(disk_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(b'disk')

    def create_cloud_init_seed(
        self,
        instance_id: str,
        vm_name: str,
        ssh_public_key: str,
        seed_iso_path: str,
        username: str,
    ):
        path = Path(seed_iso_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(b'seed')

    def create_domain(
        self,
        domain_name: str,
        memory_mb: int,
        vcpu: int,
        disk_path: str,
        seed_iso_path: str,
    ):
        self.domain_created = True
        raise RuntimeError('domain create failed')

    def domain_exists(self, name: str) -> bool:
        return self.domain_created

    def destroy_domain(self, name: str):
        self.destroy_called = True

    def undefine_domain(self, name: str):
        self.undefine_called = True


class ComputePhase4Base(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='phase4-owner', password='testpass')
        self.image = ComputeImage.objects.create(
            name='ubuntu',
            version='24.04',
            local_path='/tmp/ubuntu-24.04.qcow2',
            checksum_sha256='',
            is_active=True,
            created_by=self.user,
        )
        self.flavor = ComputeFlavor.objects.create(name='phase4-small', vcpu=1, memory_mb=1024, disk_gb=20)
        self.key = SSHKeyPair.objects.create(owner=self.user, name='main', public_key=SSH_KEY)
        self.instance = ComputeInstance.objects.create(
            owner=self.user,
            name='phase4-instance',
            image=self.image,
            flavor=self.flavor,
            ssh_key=self.key,
            state='running',
            desired_state='running',
            private_ip='192.168.122.55',
        )


class ComputeWorkerRetryTests(ComputePhase4Base):
    def test_finish_job_reschedules_retry_before_max_attempts(self):
        op = ComputeOperation.objects.create(
            instance=self.instance,
            requested_by=self.user,
            operation='start',
            status='running',
            attempt_count=1,
            max_attempts=3,
            retry_backoff_seconds=2,
            started_at=timezone.now(),
            scheduled_for=timezone.now(),
        )

        command = WorkerCommand()
        before = timezone.now()
        mode = command._finish_job(op.id, success=False, message='temporary failure', result={'code': 'E_TEMP'})

        self.assertEqual(mode, 'retried')
        op.refresh_from_db()
        self.assertEqual(op.status, 'pending')
        self.assertEqual(op.worker_id, '')
        self.assertIsNone(op.started_at)
        self.assertIsNone(op.finished_at)
        self.assertIn('auto-retry scheduled', op.error)
        self.assertGreater(op.scheduled_for, before)

    def test_finish_job_marks_failed_when_max_attempts_exhausted(self):
        op = ComputeOperation.objects.create(
            instance=self.instance,
            requested_by=self.user,
            operation='start',
            status='running',
            attempt_count=3,
            max_attempts=3,
            retry_backoff_seconds=2,
            started_at=timezone.now(),
            scheduled_for=timezone.now(),
        )

        command = WorkerCommand()
        mode = command._finish_job(op.id, success=False, message='hard failure', result={'code': 'E_HARD'})

        self.assertEqual(mode, 'failed')
        op.refresh_from_db()
        self.assertEqual(op.status, 'failed')
        self.assertEqual(op.error, 'hard failure')
        self.assertIsNotNone(op.finished_at)

    def test_finish_job_does_not_retry_non_retryable_operation(self):
        op = ComputeOperation.objects.create(
            instance=self.instance,
            requested_by=self.user,
            operation='terminate',
            status='running',
            attempt_count=1,
            max_attempts=3,
            retry_backoff_seconds=2,
            started_at=timezone.now(),
            scheduled_for=timezone.now(),
        )

        command = WorkerCommand()
        mode = command._finish_job(op.id, success=False, message='terminate failure', result={})

        self.assertEqual(mode, 'failed')
        op.refresh_from_db()
        self.assertEqual(op.status, 'failed')


class ComputeCreateRollbackTests(ComputePhase4Base):
    def test_create_instance_rolls_back_partial_assets_on_failure(self):
        with tempfile.TemporaryDirectory(prefix='phase4-create-rollback-') as tmp:
            disks = Path(tmp) / 'disks'
            seeds = Path(tmp) / 'seeds'
            driver = _FailingCreateDriver()
            service = ComputeService(driver=driver)

            with override_settings(COMPUTE_DISKS_DIR=str(disks), COMPUTE_SEEDS_DIR=str(seeds)):
                with self.assertRaises(RuntimeError):
                    service.create_instance(self.instance, payload={})

                expected_disk = disks / f'{self.instance.instance_id}.qcow2'
                expected_seed = seeds / f'{self.instance.instance_id}.iso'
                self.assertFalse(expected_disk.exists())
                self.assertFalse(expected_seed.exists())
                self.assertTrue(driver.destroy_called)
                self.assertTrue(driver.undefine_called)


class CleanupComputeOrphansCommandTests(ComputePhase4Base):
    def test_cleanup_compute_orphans_keeps_active_and_removes_orphans(self):
        with tempfile.TemporaryDirectory(prefix='phase4-cleanup-') as tmp:
            disks = Path(tmp) / 'disks'
            seeds = Path(tmp) / 'seeds'
            disks.mkdir(parents=True, exist_ok=True)
            seeds.mkdir(parents=True, exist_ok=True)

            active_disk = disks / f'{self.instance.instance_id}.qcow2'
            active_seed = seeds / f'{self.instance.instance_id}.iso'
            active_disk.write_bytes(b'active-disk')
            active_seed.write_bytes(b'active-seed')
            self.instance.disk_path = str(active_disk)
            self.instance.seed_iso_path = str(active_seed)
            self.instance.save(update_fields=['disk_path', 'seed_iso_path', 'updated_at'])

            terminated = ComputeInstance.objects.create(
                owner=self.user,
                name='phase4-terminated',
                image=self.image,
                flavor=self.flavor,
                ssh_key=self.key,
                state='terminated',
                desired_state='terminated',
            )
            terminated_disk = disks / f'{terminated.instance_id}.qcow2'
            terminated_seed = seeds / f'{terminated.instance_id}.iso'
            terminated_disk.write_bytes(b'terminated-disk')
            terminated_seed.write_bytes(b'terminated-seed')
            terminated.disk_path = str(terminated_disk)
            terminated.seed_iso_path = str(terminated_seed)
            terminated.save(update_fields=['disk_path', 'seed_iso_path', 'updated_at'])

            orphan_disk = disks / 'i-orphan123.qcow2'
            orphan_seed = seeds / 'i-orphan123.iso'
            orphan_disk.write_bytes(b'orphan-disk')
            orphan_seed.write_bytes(b'orphan-seed')

            with override_settings(COMPUTE_DISKS_DIR=str(disks), COMPUTE_SEEDS_DIR=str(seeds)):
                call_command('cleanup_compute_orphans', '--dry-run')
                self.assertTrue(active_disk.exists())
                self.assertTrue(active_seed.exists())
                self.assertTrue(terminated_disk.exists())
                self.assertTrue(terminated_seed.exists())
                self.assertTrue(orphan_disk.exists())
                self.assertTrue(orphan_seed.exists())

                call_command('cleanup_compute_orphans')
                self.assertTrue(active_disk.exists())
                self.assertTrue(active_seed.exists())
                self.assertFalse(terminated_disk.exists())
                self.assertFalse(terminated_seed.exists())
                self.assertFalse(orphan_disk.exists())
                self.assertFalse(orphan_seed.exists())
