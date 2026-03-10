from __future__ import annotations

import json
from io import StringIO
from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone

from sites.models import ComputeEvent, ComputeFlavor, ComputeImage, ComputeInstance, ComputeOperation, SSHKeyPair


SSH_KEY = (
    "ssh-ed25519 "
    "AAAAC3NzaC1lZDI1NTE5AAAAIF5u0OQ4X7m2c3hG2f0qM4G4YhYzu3PV6PvJEa3TBUnV "
    "owner@example"
)


class ComputePhase6Base(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='phase6-owner', password='testpass')
        self.image = ComputeImage.objects.create(
            name='ubuntu',
            version='24.04',
            local_path='/tmp/ubuntu-24.04.qcow2',
            checksum_sha256='',
            is_active=True,
            created_by=self.user,
        )
        self.flavor = ComputeFlavor.objects.create(name='phase6-small', vcpu=1, memory_mb=1024, disk_gb=20)
        self.key = SSHKeyPair.objects.create(owner=self.user, name='main', public_key=SSH_KEY)
        self.instance = ComputeInstance.objects.create(
            owner=self.user,
            name='phase6-instance',
            image=self.image,
            flavor=self.flavor,
            ssh_key=self.key,
            state='running',
            desired_state='running',
            private_ip='192.168.122.77',
        )


class ComputeWorkerStructuredEventTests(ComputePhase6Base):
    @patch('sites.management.commands.run_compute_worker.ComputeService.execute_operation')
    def test_worker_emits_started_and_finished_events(self, mocked_execute):
        mocked_execute.return_value = (True, 'describe succeeded', {'state': 'running'})
        op = ComputeOperation.objects.create(
            instance=self.instance,
            requested_by=self.user,
            operation='describe',
            status='pending',
            scheduled_for=timezone.now() - timezone.timedelta(seconds=1),
        )

        call_command('run_compute_worker', '--once', stdout=StringIO())
        op.refresh_from_db()
        self.assertEqual(op.status, 'success')

        started = ComputeEvent.objects.filter(operation=op, event_type='operation_started').first()
        finished = ComputeEvent.objects.filter(operation=op, event_type='operation_finished').first()
        self.assertIsNotNone(started)
        self.assertIsNotNone(finished)
        self.assertEqual(started.metadata.get('operation_id'), op.id)
        self.assertEqual(started.metadata.get('correlation_id'), f'compute-op-{op.id}')
        self.assertEqual(finished.metadata.get('finish_mode'), 'success')


class ReconcileDriftRepairTests(ComputePhase6Base):
    @patch('sites.management.commands.reconcile_compute_state.LibvirtComputeDriver')
    @patch('sites.management.commands.reconcile_compute_state.ComputeService')
    def test_reconcile_queues_repair_operation_for_drift(self, mocked_service_cls, mocked_driver_cls):
        self.instance.desired_state = 'running'
        self.instance.state = 'running'
        self.instance.save(update_fields=['desired_state', 'state', 'updated_at'])

        mocked_service = mocked_service_cls.return_value
        mocked_service.describe_instance.return_value = {'state': 'stopped', 'private_ip': None}
        mocked_driver = mocked_driver_cls.return_value
        mocked_driver.list_domains.return_value = []

        call_command('reconcile_compute_state', '--repair-drift', stdout=StringIO())

        repair = ComputeOperation.objects.filter(instance=self.instance, operation='start', status='pending').first()
        self.assertIsNotNone(repair)
        self.assertTrue(
            ComputeEvent.objects.filter(instance=self.instance, event_type='drift_detected').exists()
        )
        self.assertTrue(
            ComputeEvent.objects.filter(instance=self.instance, event_type='drift_repair_queued').exists()
        )


class ComputeMetricsCommandTests(ComputePhase6Base):
    def test_compute_metrics_outputs_expected_json_shape(self):
        now = timezone.now()
        ComputeOperation.objects.create(
            instance=self.instance,
            requested_by=self.user,
            operation='create',
            status='success',
            started_at=now - timezone.timedelta(seconds=90),
            finished_at=now - timezone.timedelta(seconds=30),
        )
        ComputeOperation.objects.create(
            instance=self.instance,
            requested_by=self.user,
            operation='start',
            status='failed',
            started_at=now - timezone.timedelta(seconds=50),
            finished_at=now - timezone.timedelta(seconds=20),
        )
        ComputeOperation.objects.create(
            instance=self.instance,
            requested_by=self.user,
            operation='describe',
            status='pending',
            scheduled_for=now + timezone.timedelta(seconds=10),
        )

        out = StringIO()
        call_command('compute_metrics', '--window-hours', '24', stdout=out)
        payload = json.loads(out.getvalue())

        self.assertIn('instances', payload)
        self.assertIn('operations', payload)
        self.assertIn('queue', payload)
        self.assertIn('host', payload)
        self.assertIn('alerts', payload)
        self.assertEqual(payload['operations']['by_status'].get('success'), 1)
        self.assertEqual(payload['operations']['by_status'].get('failed'), 1)
        self.assertEqual(payload['operations']['by_status'].get('pending'), 1)
