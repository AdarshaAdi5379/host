from django.contrib.auth.models import User
from django.test import TestCase

from sites.gateway_jobs import enqueue_gateway_apply
from sites.models import GatewayApplyJob, WordPressSite


class GatewayJobQueueTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='owner', password='testpass')
        self.site = WordPressSite.objects.create(
            name='queue-demo',
            domain='queue-demo.local',
            port=9911,
            framework='react_django',
            admin_username='admin',
            admin_password='secret',
            site_directory='/tmp/queue-demo',
            docker_compose_path='/tmp/queue-demo/docker-compose.yml',
            status='running',
            owner=self.user,
        )

    def test_enqueue_coalesces_pending_jobs(self):
        job_1 = enqueue_gateway_apply(self.site, requested_by=self.user, reason='first')
        job_2 = enqueue_gateway_apply(self.site, requested_by=self.user, reason='second')

        self.assertEqual(job_1.id, job_2.id)
        self.assertEqual(GatewayApplyJob.objects.filter(site=self.site, status='pending').count(), 1)
        self.assertEqual(GatewayApplyJob.objects.filter(site=self.site).count(), 1)
