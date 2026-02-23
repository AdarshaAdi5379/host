from rest_framework import serializers
from django.contrib.auth.models import User
from .models import WordPressSite, CustomDomain, ProjectMembership, AuditLog, UserProfile


class WordPressSiteSerializer(serializers.ModelSerializer):
    """Serializer for WordPress site listing"""
    
    class Meta:
        model = WordPressSite
        fields = [
            'id', 'name', 'domain', 'port', 'status', 
            'created_at', 'updated_at', 'admin_username',
            'subdomain', 'public_url', 'public_access_enabled',
            'owner'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'port', 'domain', 'owner']
    
    owner = serializers.CharField(source='owner.username', read_only=True, allow_null=True, required=False)


class WordPressSiteCreateSerializer(serializers.Serializer):
    """Serializer for creating a new WordPress site"""
    
    name = serializers.CharField(max_length=100)
    admin_username = serializers.CharField(max_length=100)
    admin_password = serializers.CharField(max_length=255, write_only=True)
    
    def validate_name(self, value):
        """Validate site name is alphanumeric and lowercase"""
        if not value.replace('-', '').replace('_', '').isalnum():
            raise serializers.ValidationError(
                "Site name must contain only letters, numbers, hyphens, and underscores"
            )
        return value.lower()


class CustomDomainSerializer(serializers.ModelSerializer):
    """Serializer for Custom Domain"""
    
    site_name = serializers.CharField(source='site.name', read_only=True)
    site_domain = serializers.CharField(source='site.domain', read_only=True)
    
    class Meta:
        model = CustomDomain
        fields = [
            'id', 'domain_name', 'site', 'site_name', 'site_domain',
            'cloudflare_zone_id', 'nameservers', 'status',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'cloudflare_zone_id', 'nameservers', 'status', 'created_at', 'updated_at']


class ConnectDomainSerializer(serializers.Serializer):
    """Serializer for domain connection request"""
    
    domain_name = serializers.CharField(max_length=255)
    
    def validate_domain_name(self, value):
        """Validate domain name format"""
        import re
        # Basic domain validation regex
        domain_pattern = r'^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$'
        
        if not re.match(domain_pattern, value):
            raise serializers.ValidationError("Invalid domain name format")
        
        # Check if domain already exists
        if CustomDomain.objects.filter(domain_name=value).exists():
            raise serializers.ValidationError("This domain is already connected to a site")
        
        return value.lower()


class FileBrowserCredentialsSerializer(serializers.Serializer):
    """Serializer for FileBrowser credentials response"""
    
    username = serializers.CharField()
    password = serializers.CharField()
    url = serializers.URLField()


class UserSerializer(serializers.ModelSerializer):
    """Serializer for User details (for team members)"""
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'date_joined']
        read_only_fields = ['id', 'date_joined']


class UserProfileSerializer(serializers.ModelSerializer):
    """Serializer for User Profile with RBAC info"""
    
    user = UserSerializer(read_only=True)
    is_super_admin = serializers.BooleanField(read_only=True)
    can_create_project = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = UserProfile
        fields = [
            'id', 'user', 'platform_role', 'project_quota',
            'email_notifications', 'is_super_admin', 'can_create_project',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class ProjectMembershipSerializer(serializers.ModelSerializer):
    """Serializer for Project Team Members"""
    
    user = UserSerializer(read_only=True)
    invited_by = UserSerializer(read_only=True)
    project_name = serializers.CharField(source='project.name', read_only=True)
    
    class Meta:
        model = ProjectMembership
        fields = [
            'id', 'project', 'project_name', 'user', 'role',
            'permissions', 'invited_by', 'joined_at', 'updated_at'
        ]
        read_only_fields = ['id', 'joined_at', 'updated_at', 'invited_by']


class InviteMemberSerializer(serializers.Serializer):
    """Serializer for inviting a team member"""
    
    email = serializers.EmailField()
    role = serializers.ChoiceField(
        choices=ProjectMembership.ROLE_CHOICES,
        default='collaborator'
    )


class AuditLogSerializer(serializers.ModelSerializer):
    """Serializer for Audit Logs"""
    
    user = UserSerializer(read_only=True)
    project_name = serializers.CharField(source='project.name', read_only=True, allow_null=True)
    
    class Meta:
        model = AuditLog
        fields = [
            'id', 'user', 'project', 'project_name', 'action',
            'description', 'ip_address', 'metadata', 'timestamp'
        ]
        read_only_fields = ['id', 'timestamp']


class ServerStatsSerializer(serializers.Serializer):
    """Serializer for Super Admin server statistics"""
    
    total_users = serializers.IntegerField()
    total_projects = serializers.IntegerField()
    active_containers = serializers.IntegerField()
    server_cpu_percent = serializers.FloatField()
    server_memory_percent = serializers.FloatField()
    server_disk_usage_gb = serializers.FloatField()
    server_disk_percent = serializers.FloatField()
    total_storage_used_gb = serializers.FloatField()
    active_malware_alerts = serializers.IntegerField()
