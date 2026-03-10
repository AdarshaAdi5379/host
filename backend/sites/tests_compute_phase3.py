from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APITestCase

from sites.models import (
    ComputeFlavor,
    ComputeImage,
    ComputeInstance,
    ComputeOperation,
    SSHKeyPair,
    SecurityGroup,
    SecurityGroupRule,
)


SSH_KEY = (
    "ssh-ed25519 "
    "AAAAC3NzaC1lZDI1NTE5AAAAIF5u0OQ4X7m2c3hG2f0qM4G4YhYzu3PV6PvJEa3TBUnV "
    "owner@example"
)


class SecurityGroupRuleValidationTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='sg-owner', password='testpass')
        self.group = SecurityGroup.objects.create(owner=self.user, name='default')

    def test_invalid_cidr_raises_validation_error(self):
        rule = SecurityGroupRule(
            security_group=self.group,
            direction='ingress',
            protocol='tcp',
            from_port=22,
            to_port=22,
            cidr='not-a-cidr',
        )
        with self.assertRaises(ValidationError):
            rule.full_clean()

    def test_icmp_rule_does_not_require_ports(self):
        rule = SecurityGroupRule(
            security_group=self.group,
            direction='ingress',
            protocol='icmp',
            cidr='0.0.0.0/0',
        )
        rule.full_clean()  # should not raise


class ComputePhase3ApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='phase3-owner', password='testpass')
        self.client.force_authenticate(self.user)

        self.image = ComputeImage.objects.create(
            name='ubuntu',
            version='24.04',
            local_path='/tmp/ubuntu-24.04.qcow2',
            is_active=True,
            created_by=self.user,
        )
        self.flavor = ComputeFlavor.objects.create(name='p3-small', vcpu=1, memory_mb=1024, disk_gb=20)
        self.key = SSHKeyPair.objects.create(owner=self.user, name='main', public_key=SSH_KEY)
        self.group = SecurityGroup.objects.create(owner=self.user, name='web', is_default=True)

        self.instance = ComputeInstance.objects.create(
            owner=self.user,
            name='phase3-instance',
            image=self.image,
            flavor=self.flavor,
            ssh_key=self.key,
            state='running',
            desired_state='running',
            private_ip='192.168.122.40',
        )
        self.instance.security_groups.add(self.group)

    def test_set_instance_security_groups_queues_reconcile(self):
        response = self.client.post(
            f'/api/compute-instances/{self.instance.id}/security-groups/',
            {'security_group_ids': [self.group.id]},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('reconcile_jobs', response.data)
        self.assertEqual(len(response.data['reconcile_jobs']), 1)
        self.assertEqual(
            ComputeOperation.objects.filter(instance=self.instance, operation='reconcile', status='pending').count(),
            1,
        )

    def test_create_security_group_rule_queues_reconcile(self):
        response = self.client.post(
            f'/api/security-groups/{self.group.id}/rules/',
            {
                'direction': 'ingress',
                'protocol': 'tcp',
                'from_port': 22,
                'to_port': 22,
                'cidr': '0.0.0.0/0',
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('reconcile_jobs', response.data)
        self.assertEqual(len(response.data['reconcile_jobs']), 1)
        self.assertEqual(
            ComputeOperation.objects.filter(instance=self.instance, operation='reconcile', status='pending').count(),
            1,
        )
