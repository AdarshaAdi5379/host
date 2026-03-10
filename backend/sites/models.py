from django.db import models
from django.utils import timezone
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db.models import Q
import base64
import binascii
import hashlib
import uuid


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
    db_dr_config = models.JSONField(default=dict, blank=True)  # RDS disaster recovery/failover settings
    
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
    replica_count = models.IntegerField(default=1)  # Number of backend replicas (react_django only; 1 = no LB)
    backend_ports = models.JSONField(default=list, blank=True)  # Host ports for each backend replica e.g. [9001, 9002, 9003]
    gateway_config_hash = models.CharField(max_length=64, blank=True, default='')
    gateway_last_synced_at = models.DateTimeField(blank=True, null=True)
    gateway_last_error = models.TextField(blank=True, default='')

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


class ProjectService(models.Model):
    """
    Represents a routable service reachable from the project's gateway container.
    """
    PROTOCOL_CHOICES = [
        ('http', 'HTTP'),
    ]

    site = models.ForeignKey(
        WordPressSite,
        on_delete=models.CASCADE,
        related_name='project_services'
    )
    name = models.CharField(max_length=100)
    container_name = models.CharField(max_length=120)
    internal_port = models.PositiveIntegerField(default=8000)
    protocol = models.CharField(max_length=10, choices=PROTOCOL_CHOICES, default='http')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        verbose_name = 'Project Service'
        verbose_name_plural = 'Project Services'
        constraints = [
            models.UniqueConstraint(fields=['site', 'name'], name='uniq_project_service_name'),
            models.UniqueConstraint(
                fields=['site', 'container_name', 'internal_port'],
                name='uniq_project_service_target'
            ),
        ]

    def __str__(self):
        return f"{self.site.name}:{self.name} -> {self.container_name}:{self.internal_port}"


class ApiRoute(models.Model):
    """
    Maps a project API path (/api/<something>/ or nested /api/v1/products/) to a ProjectService.
    """
    site = models.ForeignKey(
        WordPressSite,
        on_delete=models.CASCADE,
        related_name='api_routes'
    )
    service = models.ForeignKey(
        ProjectService,
        on_delete=models.CASCADE,
        related_name='routes'
    )
    path = models.CharField(max_length=255)  # Canonical form: /api/<segment...>/
    strip_prefix = models.BooleanField(default=True)
    is_enabled = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name='created_api_routes',
        null=True,
        blank=True
    )
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['path']
        verbose_name = 'API Route'
        verbose_name_plural = 'API Routes'
        constraints = [
            models.UniqueConstraint(fields=['site', 'path'], name='uniq_project_api_path'),
            models.CheckConstraint(
                check=Q(path__startswith='/api/'),
                name='api_route_must_start_with_api_prefix'
            ),
        ]

    def clean(self):
        from .gateway_routing import normalize_api_route_path

        self.path = normalize_api_route_path(self.path)

        if self.service_id and self.site_id and self.service.site_id != self.site_id:
            raise ValidationError({'service': 'Service must belong to the same project.'})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.site.name}: {self.path} -> {self.service.name}"


class GatewayApplyJob(models.Model):
    """
    Asynchronous gateway apply job executed by a privileged worker process.
    """
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('running', 'Running'),
        ('success', 'Success'),
        ('failed', 'Failed'),
        ('superseded', 'Superseded'),
    ]

    site = models.ForeignKey(
        WordPressSite,
        on_delete=models.CASCADE,
        related_name='gateway_apply_jobs'
    )
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name='gateway_apply_jobs',
        null=True,
        blank=True
    )
    reason = models.CharField(max_length=120, blank=True, default='')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    error = models.TextField(blank=True, default='')
    worker_id = models.CharField(max_length=120, blank=True, default='')
    scheduled_for = models.DateTimeField(default=timezone.now)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Gateway Apply Job'
        verbose_name_plural = 'Gateway Apply Jobs'
        indexes = [
            models.Index(fields=['status', 'scheduled_for']),
            models.Index(fields=['site', '-created_at']),
        ]

    def __str__(self):
        return f"gateway:{self.site.name}:{self.status}:{self.id}"


class ComputeImage(models.Model):
    """Image catalog entry used as an immutable base for instance overlays."""

    OS_FAMILY_CHOICES = [
        ('ubuntu', 'Ubuntu'),
        ('debian', 'Debian'),
        ('centos', 'CentOS'),
        ('rocky', 'Rocky Linux'),
        ('other', 'Other'),
    ]

    name = models.CharField(max_length=120)
    version = models.CharField(max_length=60, default='latest')
    source_url = models.URLField(blank=True, null=True)
    checksum_sha256 = models.CharField(max_length=64, blank=True, default='')
    local_path = models.CharField(max_length=500, help_text='Absolute path to immutable cloud image')
    os_family = models.CharField(max_length=30, choices=OS_FAMILY_CHOICES, default='ubuntu')
    minimum_disk_gb = models.PositiveIntegerField(default=10)
    is_active = models.BooleanField(default=True)
    is_default = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name='compute_images',
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name', '-created_at']
        verbose_name = 'Compute Image'
        verbose_name_plural = 'Compute Images'
        constraints = [
            models.UniqueConstraint(fields=['name', 'version'], name='uniq_compute_image_name_version'),
        ]

    def clean(self):
        if self.is_default and not self.is_active:
            raise ValidationError({'is_default': 'Default image must be active.'})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)
        if self.is_default:
            (
                ComputeImage.objects
                .exclude(id=self.id)
                .filter(is_default=True)
                .update(is_default=False, updated_at=timezone.now())
            )

    def __str__(self):
        return f"{self.name}:{self.version}"


class ComputeFlavor(models.Model):
    """Defines vCPU/memory/disk profiles for VM instances."""

    name = models.CharField(max_length=120, unique=True)
    vcpu = models.PositiveSmallIntegerField(default=1)
    memory_mb = models.PositiveIntegerField(default=1024)
    disk_gb = models.PositiveIntegerField(default=20)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['vcpu', 'memory_mb', 'disk_gb']
        verbose_name = 'Compute Flavor'
        verbose_name_plural = 'Compute Flavors'

    def __str__(self):
        return f"{self.name} ({self.vcpu} vCPU/{self.memory_mb}MB/{self.disk_gb}GB)"


class SSHKeyPair(models.Model):
    """Tenant-owned SSH public key used for VM login provisioning."""

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='ssh_key_pairs',
    )
    name = models.CharField(max_length=120)
    public_key = models.TextField()
    fingerprint = models.CharField(max_length=95, blank=True, default='')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'SSH Key Pair'
        verbose_name_plural = 'SSH Key Pairs'
        constraints = [
            models.UniqueConstraint(fields=['owner', 'name'], name='uniq_owner_ssh_key_name'),
            models.UniqueConstraint(fields=['owner', 'fingerprint'], name='uniq_owner_ssh_key_fingerprint'),
        ]

    @staticmethod
    def _fingerprint_from_public_key(public_key: str) -> str:
        chunks = (public_key or '').strip().split()
        if len(chunks) < 2:
            raise ValidationError({'public_key': 'Invalid SSH public key format.'})
        key_type, key_blob = chunks[0], chunks[1]
        if key_type not in {'ssh-rsa', 'ssh-ed25519', 'ecdsa-sha2-nistp256', 'ecdsa-sha2-nistp384', 'ecdsa-sha2-nistp521'}:
            raise ValidationError({'public_key': f'Unsupported SSH key type: {key_type}'})

        try:
            key_bytes = base64.b64decode(key_blob.encode('ascii'))
        except (ValueError, binascii.Error) as exc:
            raise ValidationError({'public_key': f'Invalid SSH key body: {exc}'}) from exc

        digest = base64.b64encode(hashlib.sha256(key_bytes).digest()).decode('ascii').rstrip('=')
        return f"SHA256:{digest}"

    def clean(self):
        self.fingerprint = self._fingerprint_from_public_key(self.public_key)

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.owner.username}:{self.name}"


class SecurityGroup(models.Model):
    """Tenant-scoped network policy group."""

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='security_groups',
    )
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True, default='')
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        verbose_name = 'Security Group'
        verbose_name_plural = 'Security Groups'
        constraints = [
            models.UniqueConstraint(fields=['owner', 'name'], name='uniq_owner_security_group_name'),
        ]

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if self.is_default:
            (
                SecurityGroup.objects
                .exclude(id=self.id)
                .filter(owner=self.owner, is_default=True)
                .update(is_default=False, updated_at=timezone.now())
            )

    def __str__(self):
        return f"{self.owner.username}:{self.name}"


class SecurityGroupRule(models.Model):
    """Rule entry in a security group."""

    DIRECTION_CHOICES = [
        ('ingress', 'Ingress'),
        ('egress', 'Egress'),
    ]
    PROTOCOL_CHOICES = [
        ('tcp', 'TCP'),
        ('udp', 'UDP'),
        ('icmp', 'ICMP'),
        ('all', 'All'),
    ]

    security_group = models.ForeignKey(
        SecurityGroup,
        on_delete=models.CASCADE,
        related_name='rules',
    )
    direction = models.CharField(max_length=10, choices=DIRECTION_CHOICES, default='ingress')
    protocol = models.CharField(max_length=10, choices=PROTOCOL_CHOICES, default='tcp')
    from_port = models.PositiveIntegerField(null=True, blank=True)
    to_port = models.PositiveIntegerField(null=True, blank=True)
    cidr = models.CharField(max_length=50, default='0.0.0.0/0')
    description = models.CharField(max_length=255, blank=True, default='')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['direction', 'protocol', 'from_port']
        verbose_name = 'Security Group Rule'
        verbose_name_plural = 'Security Group Rules'

    def clean(self):
        if self.protocol == 'all':
            self.from_port = None
            self.to_port = None
            return
        if self.from_port is None or self.to_port is None:
            raise ValidationError({'from_port': 'from_port and to_port are required when protocol is not "all".'})
        if self.from_port > self.to_port:
            raise ValidationError({'to_port': 'to_port must be greater than or equal to from_port.'})
        if self.to_port > 65535:
            raise ValidationError({'to_port': 'Port must be <= 65535.'})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        port_display = 'all'
        if self.from_port is not None and self.to_port is not None:
            port_display = f"{self.from_port}-{self.to_port}"
        return f"{self.security_group.name}:{self.direction}:{self.protocol}:{port_display}"


class ComputeInstance(models.Model):
    """Tenant VM instance tracked by the control plane."""

    STATE_CHOICES = [
        ('provisioning', 'Provisioning'),
        ('pending', 'Pending'),
        ('running', 'Running'),
        ('stopped', 'Stopped'),
        ('starting', 'Starting'),
        ('stopping', 'Stopping'),
        ('rebooting', 'Rebooting'),
        ('terminating', 'Terminating'),
        ('terminated', 'Terminated'),
        ('error', 'Error'),
    ]
    DESIRED_STATE_CHOICES = [
        ('running', 'Running'),
        ('stopped', 'Stopped'),
        ('terminated', 'Terminated'),
    ]
    TERMINAL_STATES = {'terminated', 'error'}

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='compute_instances',
    )
    name = models.CharField(max_length=120)
    instance_id = models.CharField(max_length=24, unique=True, blank=True, default='')
    state = models.CharField(max_length=20, choices=STATE_CHOICES, default='provisioning')
    desired_state = models.CharField(max_length=20, choices=DESIRED_STATE_CHOICES, default='running')
    private_ip = models.GenericIPAddressField(blank=True, null=True)
    public_ip = models.GenericIPAddressField(blank=True, null=True)
    image = models.ForeignKey(
        ComputeImage,
        on_delete=models.PROTECT,
        related_name='instances',
    )
    flavor = models.ForeignKey(
        ComputeFlavor,
        on_delete=models.PROTECT,
        related_name='instances',
    )
    ssh_key = models.ForeignKey(
        SSHKeyPair,
        on_delete=models.SET_NULL,
        related_name='instances',
        null=True,
        blank=True,
    )
    security_groups = models.ManyToManyField(SecurityGroup, related_name='instances', blank=True)
    libvirt_domain_name = models.CharField(max_length=255, blank=True, default='')
    libvirt_domain_uuid = models.CharField(max_length=64, blank=True, default='')
    disk_path = models.CharField(max_length=500, blank=True, default='')
    seed_iso_path = models.CharField(max_length=500, blank=True, default='')
    cloud_init_completed = models.BooleanField(default=False)
    last_error = models.TextField(blank=True, default='')
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    launched_at = models.DateTimeField(null=True, blank=True)
    terminated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Compute Instance'
        verbose_name_plural = 'Compute Instances'
        constraints = [
            models.UniqueConstraint(fields=['owner', 'name'], name='uniq_owner_compute_instance_name'),
        ]
        indexes = [
            models.Index(fields=['owner', 'state']),
            models.Index(fields=['instance_id']),
        ]

    def save(self, *args, **kwargs):
        if not self.instance_id:
            self.instance_id = f"i-{uuid.uuid4().hex[:17]}"
        if not self.libvirt_domain_name:
            self.libvirt_domain_name = f"vm-{self.instance_id}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.instance_id}:{self.name}:{self.state}"


class ComputeOperation(models.Model):
    """Lifecycle operation record executed asynchronously by compute workers."""

    OPERATION_CHOICES = [
        ('create', 'Create'),
        ('start', 'Start'),
        ('stop', 'Stop'),
        ('reboot', 'Reboot'),
        ('terminate', 'Terminate'),
        ('describe', 'Describe'),
        ('reconcile', 'Reconcile'),
    ]
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('running', 'Running'),
        ('success', 'Success'),
        ('failed', 'Failed'),
        ('superseded', 'Superseded'),
        ('cancelled', 'Cancelled'),
    ]

    instance = models.ForeignKey(
        ComputeInstance,
        on_delete=models.CASCADE,
        related_name='operations',
    )
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name='compute_operations',
        null=True,
        blank=True,
    )
    operation = models.CharField(max_length=20, choices=OPERATION_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    request_payload = models.JSONField(default=dict, blank=True)
    result_payload = models.JSONField(default=dict, blank=True)
    idempotency_key = models.CharField(max_length=80, blank=True, default='')
    error = models.TextField(blank=True, default='')
    worker_id = models.CharField(max_length=120, blank=True, default='')
    scheduled_for = models.DateTimeField(default=timezone.now)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Compute Operation'
        verbose_name_plural = 'Compute Operations'
        indexes = [
            models.Index(fields=['status', 'scheduled_for']),
            models.Index(fields=['instance', '-created_at']),
            models.Index(fields=['idempotency_key']),
        ]

    def __str__(self):
        return f"compute:{self.instance.instance_id}:{self.operation}:{self.status}:{self.id}"


class ComputeEvent(models.Model):
    """Operation/audit event timeline for compute instances."""

    instance = models.ForeignKey(
        ComputeInstance,
        on_delete=models.CASCADE,
        related_name='events',
    )
    operation = models.ForeignKey(
        ComputeOperation,
        on_delete=models.SET_NULL,
        related_name='events',
        null=True,
        blank=True,
    )
    event_type = models.CharField(max_length=60)
    message = models.TextField(blank=True, default='')
    metadata = models.JSONField(default=dict, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name='compute_events',
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Compute Event'
        verbose_name_plural = 'Compute Events'
        indexes = [
            models.Index(fields=['instance', '-created_at']),
            models.Index(fields=['event_type', '-created_at']),
        ]

    def __str__(self):
        return f"{self.instance.instance_id}:{self.event_type}:{self.created_at.isoformat()}"


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
