from django.db import models
from django.utils import timezone


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
