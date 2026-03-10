from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APITestCase

from sites.models import ComputeFlavor, ComputeImage, ComputeInstance, ComputeOperation, SSHKeyPair


SSH_KEY = (
    "ssh-ed25519 "
    "AAAAC3NzaC1lZDI1NTE5AAAAIF5u0OQ4X7m2c3hG2f0qM4G4YhYzu3PV6PvJEa3TBUnV "
    "owner@example"
)


class ComputePhase5ApiBase(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='p5-owner', password='testpass')
        self.other = User.objects.create_user(username='p5-other', password='testpass')
        self.admin = User.objects.create_user(username='p5-admin', password='testpass')
        self.admin.is_staff = True
        self.admin.save(update_fields=['is_staff'])

        self.image = ComputeImage.objects.create(
            name='ubuntu',
            version='24.04',
            local_path='/tmp/ubuntu-24.04.qcow2',
            checksum_sha256='',
            is_active=True,
            created_by=self.owner,
        )
        self.flavor = ComputeFlavor.objects.create(name='p5-small', vcpu=1, memory_mb=1024, disk_gb=20)
        self.key = SSHKeyPair.objects.create(owner=self.owner, name='main', public_key=SSH_KEY)

        self.instance = ComputeInstance.objects.create(
            owner=self.owner,
            name='phase5-instance',
            image=self.image,
            flavor=self.flavor,
            ssh_key=self.key,
            state='stopped',
            desired_state='stopped',
        )
        self.operation = ComputeOperation.objects.create(
            instance=self.instance,
            requested_by=self.owner,
            operation='start',
            status='pending',
        )


class ComputePhase5ErrorContractTests(ComputePhase5ApiBase):
    def test_invalid_desired_state_returns_standard_error_contract(self):
        self.client.force_authenticate(self.owner)
        response = self.client.patch(
            f'/api/compute-instances/{self.instance.id}/',
            {'desired_state': 'invalid-state'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)
        self.assertEqual(response.data['error']['code'], 'invalid_request')
        self.assertIn('message', response.data['error'])
        self.assertIn('details', response.data['error'])

    def test_instance_operation_status_without_operations_returns_standard_error(self):
        self.client.force_authenticate(self.owner)
        empty = ComputeInstance.objects.create(
            owner=self.owner,
            name='phase5-empty-instance',
            image=self.image,
            flavor=self.flavor,
            ssh_key=self.key,
            state='stopped',
            desired_state='stopped',
        )
        response = self.client.get(f'/api/compute-instances/{empty.id}/operation-status/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(response.data['error']['code'], 'not_found')
        self.assertIn('No operations found', response.data['error']['message'])


class ComputePhase5PollingTests(ComputePhase5ApiBase):
    def test_compute_operation_poll_pending_and_terminal(self):
        self.client.force_authenticate(self.owner)

        pending_response = self.client.get(f'/api/compute-operations/{self.operation.id}/poll/')
        self.assertEqual(pending_response.status_code, status.HTTP_200_OK)
        self.assertEqual(pending_response.data['status'], 'pending')
        self.assertFalse(pending_response.data['terminal'])
        self.assertEqual(pending_response.data['operation']['id'], self.operation.id)
        self.assertEqual(pending_response.data['poll_after_seconds'], 2)

        self.operation.status = 'failed'
        self.operation.error = 'simulated failure'
        self.operation.save(update_fields=['status', 'error', 'updated_at'])

        failed_response = self.client.get(f'/api/compute-operations/{self.operation.id}/poll/')
        self.assertEqual(failed_response.status_code, status.HTTP_200_OK)
        self.assertEqual(failed_response.data['status'], 'failed')
        self.assertTrue(failed_response.data['terminal'])
        self.assertEqual(failed_response.data['poll_after_seconds'], 0)

    def test_instance_operation_status_by_operation_id(self):
        self.client.force_authenticate(self.owner)
        response = self.client.get(
            f'/api/compute-instances/{self.instance.id}/operation-status/?operation_id={self.operation.id}'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['operation']['id'], self.operation.id)

    def test_start_action_returns_operation_id_for_polling(self):
        self.client.force_authenticate(self.owner)
        response = self.client.post(f'/api/compute-instances/{self.instance.id}/start/', {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(response.data['status'], 'queued')
        self.assertIn('operation', response.data)
        self.assertIn('id', response.data['operation'])


class ComputePhase5AuthorizationTests(ComputePhase5ApiBase):
    def test_non_owner_cannot_access_owner_operation(self):
        self.client.force_authenticate(self.other)
        detail = self.client.get(f'/api/compute-operations/{self.operation.id}/')
        poll = self.client.get(f'/api/compute-operations/{self.operation.id}/poll/')

        self.assertEqual(detail.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(poll.status_code, status.HTTP_404_NOT_FOUND)

    def test_admin_can_access_owner_operation(self):
        self.client.force_authenticate(self.admin)
        detail = self.client.get(f'/api/compute-operations/{self.operation.id}/')
        poll = self.client.get(f'/api/compute-operations/{self.operation.id}/poll/')

        self.assertEqual(detail.status_code, status.HTTP_200_OK)
        self.assertEqual(poll.status_code, status.HTTP_200_OK)
        self.assertEqual(poll.data['operation']['id'], self.operation.id)
