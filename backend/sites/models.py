from django.db import models
from django.utils import timezone
from django.conf import settings


class WordPressSite(models.Model):
    """Model representing a WordPress site instance"""
    
    STATUS_CHOICES = [
        ('provisioning', 'Provisioning'),
        ('running', 'Running'),
        ('stopped', 'Stopped'),
        ('error', 'Error'),
    ]
    
    name = models.CharField(max_length=100, unique=True)
    domain = models.CharField(max_length=255, unique=True)  # e.g., mysite.local
    port = models.IntegerField(unique=True)  # Docker port mapping
    
    # Ownership (Multi-Tenancy)
    owner = models.ForeignKey(
        'auth.User', 
        on_delete=models.CASCADE, 
        related_name='sites',
        null=True,  # Allow null for existing sites (to be backfilled)
        blank=True
    )
    
    # WordPress credentials
    admin_username = models.CharField(max_length=100)
    admin_password = models.CharField(max_length=255)  # In production, use encryption
    
    # Status tracking
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='provisioning')
    container_id = models.CharField(max_length=100, blank=True, null=True)
    
    # Timestamps
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    
    # File paths
    site_directory = models.CharField(max_length=500)
    docker_compose_path = models.CharField(max_length=500)
    nginx_config_path = models.CharField(max_length=500, blank=True, null=True)
    
    # Public Access via Cloudflare Tunnel
    subdomain = models.CharField(max_length=63, blank=True, null=True, unique=True)  # e.g., 'mysite' for mysite.edubricz.online
    public_access_enabled = models.BooleanField(default=False)  # Whether site is publicly accessible
    public_url = models.URLField(blank=True, null=True)  # Full public URL (e.g., https://mysite.edubricz.online)
    
    # Tenant Database (Isolated MySQL Container)
    db_container_name = models.CharField(max_length=100, blank=True, null=True)  # MySQL container name
    db_container_id = models.CharField(max_length=100, blank=True, null=True)  # Docker container ID
    db_host = models.CharField(max_length=255, blank=True, null=True)  # Database hostname (container name)
    db_name = models.CharField(max_length=100, default='wordpress')  # Database name
    db_user = models.CharField(max_length=100, default='wordpress')  # Database user
    db_password = models.CharField(max_length=255, blank=True, null=True)  # Database password (encrypted in production)
    db_root_password = models.CharField(max_length=255, blank=True, null=True)  # Root password for backups
    
    # FileBrowser Credentials (Multi-tenant file access)
    filebrowser_username = models.CharField(max_length=100, blank=True, null=True)  # FileBrowser username
    filebrowser_password = models.CharField(max_length=255, blank=True, null=True)  # FileBrowser password
    
    # Full-Stack Hosting Fields
    FRAMEWORK_CHOICES = [
        ('wordpress', 'WordPress'),
        ('react_django', 'React + Django'),
        ('node', 'Node.js'),
    ]
    BUILD_STATUS_CHOICES = [
        ('idle', 'Idle'),
        ('building', 'Building'),
        ('deploying', 'Deploying'),
        ('failed', 'Failed'),
        ('running', 'Running'),
    ]
    
    framework = models.CharField(max_length=20, choices=FRAMEWORK_CHOICES, default='wordpress')
    repo_url = models.URLField(blank=True, null=True)
    branch = models.CharField(max_length=100, default='main')
    env_vars = models.JSONField(default=dict, blank=True)  # Encrypted environment variables
    build_status = models.CharField(max_length=20, choices=BUILD_STATUS_CHOICES, default='idle')
    api_port = models.IntegerField(unique=True, null=True, blank=True)  # Second port for Backend API (React+Django)
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = 'WordPress Site'
        verbose_name_plural = 'WordPress Sites'
    
    def __str__(self):
        return f"{self.name} ({self.domain})"
    
    @property
    def is_running(self):
        return self.status == 'running'

    def get_frontend_url(self):
        """Get the frontend URL for this site"""
        return f"http://{self.domain}"
    
    def get_admin_url(self):
        """Get the WordPress admin URL"""
        return f"http://{self.domain}/wp-admin"


class CustomDomain(models.Model):
    """Model representing a custom domain connected to a WordPress site"""
    
    STATUS_CHOICES = [
        ('pending', 'Pending Nameserver Update'),
        ('active', 'Active'),
        ('failed', 'Failed'),
    ]
    
    site = models.ForeignKey(
        WordPressSite, 
        on_delete=models.CASCADE, 
        related_name='custom_domains'
    )
    domain_name = models.CharField(max_length=255, unique=True)  # e.g., "myshop.com"
    cloudflare_zone_id = models.CharField(max_length=100, blank=True, null=True)
    nameservers = models.JSONField(default=list)  # List of nameserver addresses
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    # Timestamps
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Custom Domain'
        verbose_name_plural = 'Custom Domains'
    
    def __str__(self):
        return f"{self.domain_name} -> {self.site.name}"


class ProjectMembership(models.Model):
    """Model representing a team member's access to a project"""
    
    ROLE_CHOICES = [
        ('owner', 'Owner'),
        ('collaborator', 'Collaborator'),
    ]
    
    project = models.ForeignKey(
        WordPressSite,
        on_delete=models.CASCADE,
        related_name='team_members'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='project_memberships'
    )
    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        default='collaborator'
    )
    permissions = models.JSONField(
        default=dict,
        help_text='Granular permissions for this member'
    )
    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name='invited_members',
        null=True,
        blank=True
    )
    joined_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ('project', 'user')
        ordering = ['-joined_at']
        verbose_name = 'Project Membership'
        verbose_name_plural = 'Project Memberships'
    
    def __str__(self):
        return f"{self.user.email} -> {self.project.name} ({self.role})"
    
    @property
    def is_owner(self):
        return self.role == 'owner'
    
    @property
    def is_collaborator(self):
        return self.role == 'collaborator'


class AuditLog(models.Model):
    """Model for tracking all actions across the platform"""
    
    ACTION_CHOICES = [
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
        ('malware_detected', 'Malware Detected'),
    ]
    
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='audit_logs'
    )
    project = models.ForeignKey(
        WordPressSite,
        on_delete=models.CASCADE,
        related_name='audit_logs',
        null=True,
        blank=True
    )
    action = models.CharField(max_length=50, choices=ACTION_CHOICES)
    description = models.TextField(blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-timestamp']
        verbose_name = 'Audit Log'
        verbose_name_plural = 'Audit Logs'
        indexes = [
            models.Index(fields=['user', '-timestamp']),
            models.Index(fields=['project', '-timestamp']),
            models.Index(fields=['action', '-timestamp']),
        ]
    
    def __str__(self):
        return f"{self.user.email} - {self.action} at {self.timestamp}"


class UserProfile(models.Model):
    """Extended user profile for RBAC and quotas"""
    
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='profile'
    )
    # Role in the platform
    platform_role = models.CharField(
        max_length=20,
        choices=[
            ('super_admin', 'Super Admin'),
            ('user', 'User'),
        ],
        default='user'
    )
    # Project quota (0 = unlimited for super admins)
    project_quota = models.IntegerField(default=5)
    # Notification preferences
    email_notifications = models.BooleanField(default=True)
    # Security settings
    last_password_change = models.DateTimeField(null=True, blank=True)
    password_change_required = models.BooleanField(default=False)
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'User Profile'
        verbose_name_plural = 'User Profiles'
    
    def __str__(self):
        return f"{self.user.email} ({self.platform_role})"
    
    @property
    def is_super_admin(self):
        return self.platform_role == 'super_admin'
    
    @property
    def can_create_project(self):
        if self.is_super_admin:
            return True
        owned_projects = ProjectMembership.objects.filter(
            user=self.user,
            role='owner'
        ).count()
        return owned_projects < self.project_quota
