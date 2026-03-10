from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APITestCase

from sites.models import ProjectMembership, UserProfile, WordPressSite


class SiteListingAccessTests(APITestCase):
    def setUp(self):
        self.super_admin_user = User.objects.create_user(
            username='platform-admin',
            email='platform-admin@example.com',
            password='testpass',
            is_staff=False,
            is_superuser=False,
        )
        profile, _ = UserProfile.objects.get_or_create(user=self.super_admin_user)
        profile.platform_role = 'super_admin'
        profile.project_quota = 0
        profile.save(update_fields=['platform_role', 'project_quota', 'updated_at'])
        self.super_admin_user.refresh_from_db()

        self.owner = User.objects.create_user(username='owner-a', password='testpass')
        self.other_owner = User.objects.create_user(username='owner-b', password='testpass')
        self.collab = User.objects.create_user(username='collab-a', password='testpass')

        self.site_1 = WordPressSite.objects.create(
            name='site-alpha',
            domain='site-alpha.local',
            port=9801,
            owner=self.owner,
            admin_username='admin',
            admin_password='secret',
            site_directory='/tmp/site-alpha',
            docker_compose_path='/tmp/site-alpha/docker-compose.yml',
            status='running',
        )
        self.site_2 = WordPressSite.objects.create(
            name='site-beta',
            domain='site-beta.local',
            port=9802,
            owner=self.other_owner,
            admin_username='admin',
            admin_password='secret',
            site_directory='/tmp/site-beta',
            docker_compose_path='/tmp/site-beta/docker-compose.yml',
            status='running',
        )

        ProjectMembership.objects.create(project=self.site_2, user=self.collab, role='collaborator')

    def test_platform_super_admin_profile_sees_all_sites_in_list(self):
        self.client.force_authenticate(self.super_admin_user)
        response = self.client.get('/api/sites/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

    def test_regular_collaborator_sees_only_owned_or_member_sites(self):
        self.client.force_authenticate(self.collab)
        response = self.client.get('/api/sites/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['name'], 'site-beta')
