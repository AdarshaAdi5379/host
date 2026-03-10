import tempfile
from pathlib import Path

from django.contrib.auth.models import User
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase
from django.test.utils import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from sites.compute_jobs import enqueue_compute_operation
from sites.models import ComputeFlavor, ComputeImage, ComputeInstance, ComputeOperation, SSHKeyPair


SSH_KEY = (
    "ssh-ed25519 "
    "AAAAC3NzaC1lZDI1NTE5AAAAIF5u0OQ4X7m2c3hG2f0qM4G4YhYzu3PV6PvJEa3TBUnV "
    "owner@example"
)


class ComputeOperationQueueTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='owner', password='testpass')
        self.image = ComputeImage.objects.create(
            name='ubuntu',
            version='24.04',
            local_path='/tmp/ubuntu-24.04.qcow2',
            checksum_sha256='',
            is_active=True,
            created_by=self.user,
        )
        self.flavor = ComputeFlavor.objects.create(name='small', vcpu=1, memory_mb=1024, disk_gb=20)
        self.key = SSHKeyPair.objects.create(owner=self.user, name='main', public_key=SSH_KEY)
        self.instance = ComputeInstance.objects.create(
            owner=self.user,
            name='demo-vm',
            image=self.image,
            flavor=self.flavor,
            ssh_key=self.key,
        )

    def test_enqueue_coalesces_pending_same_operation(self):
        op_1 = enqueue_compute_operation(self.instance, 'start', requested_by=self.user)
        op_2 = enqueue_compute_operation(self.instance, 'start', requested_by=self.user)

        self.assertEqual(op_1.id, op_2.id)
        self.assertEqual(
            ComputeOperation.objects.filter(instance=self.instance, operation='start', status='pending').count(),
            1,
        )


class ComputeInstanceApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='owner2', password='testpass')
        self.other = User.objects.create_user(username='other2', password='testpass')
        self.client.force_authenticate(self.user)

        self.image = ComputeImage.objects.create(
            name='ubuntu',
            version='22.04',
            local_path='/tmp/ubuntu-22.04.qcow2',
            checksum_sha256='',
            is_active=True,
            created_by=self.user,
        )
        self.flavor = ComputeFlavor.objects.create(name='medium', vcpu=2, memory_mb=2048, disk_gb=30)
        self.key = SSHKeyPair.objects.create(owner=self.user, name='main', public_key=SSH_KEY)
        self.other_key = SSHKeyPair.objects.create(
            owner=self.other,
            name='other-main',
            public_key=SSH_KEY.replace('owner@example', 'other@example'),
        )

    def test_create_instance_queues_async_create_operation(self):
        response = self.client.post(
            '/api/compute-instances/',
            {
                'name': 'student-api',
                'image_id': self.image.id,
                'flavor_id': self.flavor.id,
                'ssh_key_id': self.key.id,
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(response.data['status'], 'queued')
        self.assertEqual(response.data['operation']['operation'], 'create')
        self.assertEqual(response.data['operation']['status'], 'pending')
        self.assertEqual(ComputeInstance.objects.filter(owner=self.user, name='student-api').count(), 1)

    def test_create_instance_rejects_foreign_ssh_key(self):
        response = self.client.post(
            '/api/compute-instances/',
            {
                'name': 'student-api-2',
                'image_id': self.image.id,
                'flavor_id': self.flavor.id,
                'ssh_key_id': self.other_key.id,
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('ssh_key_id', response.data)


class ImportComputeImageCommandTests(TestCase):
    @override_settings(COMPUTE_IMAGES_DIR='/tmp')
    def test_import_compute_image_from_local_path(self):
        with tempfile.TemporaryDirectory(prefix='compute-image-test-') as tmp:
            source = Path(tmp) / 'src.qcow2'
            target = Path(tmp) / 'images' / 'ubuntu-24.04.qcow2'
            source.write_bytes(b'fake qcow2 image content')

            call_command(
                'import_compute_image',
                '--name',
                'ubuntu',
                '--image-version',
                '24.04',
                '--source',
                str(source),
                '--target-path',
                str(target),
                '--set-default',
            )

            image = ComputeImage.objects.get(name='ubuntu', version='24.04')
            self.assertTrue(target.exists())
            self.assertEqual(image.local_path, str(target))
            self.assertTrue(image.is_default)
            self.assertTrue(image.is_active)
            self.assertEqual(len(image.checksum_sha256), 64)

    def test_import_compute_image_checksum_mismatch_raises(self):
        with tempfile.TemporaryDirectory(prefix='compute-image-test-') as tmp:
            source = Path(tmp) / 'src.qcow2'
            target = Path(tmp) / 'ubuntu-22.04.qcow2'
            source.write_bytes(b'fake image data')

            with self.assertRaises(CommandError):
                call_command(
                    'import_compute_image',
                    '--name',
                    'ubuntu',
                    '--image-version',
                    '22.04',
                    '--source',
                    str(source),
                    '--target-path',
                    str(target),
                    '--checksum-sha256',
                    '0' * 64,
                )
