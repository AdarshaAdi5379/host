# Generated migration for Project Membership & Audit Log
from django.db import migrations, models
import django.db.models.deletion
from django.conf import settings


class Migration(migrations.Migration):
    dependencies = [
        ('wordpress_sites', '0007_wordpresssite_owner'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # Create ProjectMembership model for team collaboration
        migrations.CreateModel(
            name='ProjectMembership',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('role', models.CharField(
                    max_length=20,
                    choices=[
                        ('owner', 'Owner'),
                        ('collaborator', 'Collaborator'),
                    ],
                    default='collaborator'
                )),
                ('permissions', models.JSONField(
                    default=dict,
                    help_text='Granular permissions for this member'
                )),
                ('joined_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('invited_by', models.ForeignKey(
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='invited_members',
                    to=settings.AUTH_USER_MODEL,
                    null=True,
                    blank=True
                )),
                ('project', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='team_members',
                    to='wordpress_sites.wordpresssite'
                )),
                ('user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='project_memberships',
                    to=settings.AUTH_USER_MODEL
                )),
            ],
            options={
                'unique_together': ('project', 'user'),
                'verbose_name': 'Project Membership',
                'verbose_name_plural': 'Project Memberships',
            },
        ),
        # Create AuditLog model for tracking all actions
        migrations.CreateModel(
            name='AuditLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('action', models.CharField(
                    max_length=50,
                    choices=[
                        ('project_created', 'Project Created'),
                        ('project_deleted', 'Project Deleted'),
                        ('project_started', 'Project Started'),
                        ('project_stopped', 'Project Stopped'),
                        ('member_invited', 'Member Invited'),
                        ('member_removed', 'Member Removed'),
                        ('env_updated', 'Environment Updated'),
                        ('backup_created', 'Backup Created'),
                        ('backup_restored', 'Backup Restored'),
                        ('public_access_enabled', 'Public Access Enabled'),
                        ('public_access_disabled', 'Public Access Disabled'),
                        ('domain_connected', 'Domain Connected'),
                        ('domain_removed', 'Domain Removed'),
                        ('container_restart', 'Container Restart'),
                        ('terminal_access', 'Terminal Access'),
                        ('database_access', 'Database Access'),
                        ('file_access', 'File Access'),
                        ('login', 'User Login'),
                        ('logout', 'User Logout'),
                        ('password_reset', 'Password Reset'),
                        ('settings_updated', 'Settings Updated'),
                    ]
                )),
                ('description', models.TextField(blank=True)),
                ('ip_address', models.GenericIPAddressField(null=True, blank=True)),
                ('user_agent', models.TextField(blank=True)),
                ('metadata', models.JSONField(default=dict, blank=True)),
                ('timestamp', models.DateTimeField(auto_now_add=True)),
                ('project', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='audit_logs',
                    to='wordpress_sites.wordpresssite',
                    null=True,
                    blank=True
                )),
                ('user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='audit_logs',
                    to=settings.AUTH_USER_MODEL
                )),
            ],
            options={
                'ordering': ['-timestamp'],
                'verbose_name': 'Audit Log',
                'verbose_name_plural': 'Audit Logs',
            },
        ),
        # Add project_quota field to User model via profile extension
        # Note: We'll use a separate UserProfile model instead
    ]
