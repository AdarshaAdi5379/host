from rest_framework import serializers
from django.contrib.auth.models import User
from .models import (
    WordPressSite,
    CustomDomain,
    ProjectMembership,
    AuditLog,
    UserProfile,
    ProjectService,
    ApiRoute,
    GatewayApplyJob,
)
from .gateway_routing import normalize_api_route_path


class WordPressSiteSerializer(serializers.ModelSerializer):
    """Serializer for WordPress site listing"""
    
    class Meta:
        model = WordPressSite
        fields = [
            'id', 'name', 'domain', 'port', 'status', 
            'created_at', 'updated_at', 'admin_username',
            'subdomain', 'public_url', 'public_access_enabled',
            'owner',
            # Full-stack / LB fields
            'framework', 'api_port', 'replica_count', 'backend_ports', 'build_status',
            'gateway_last_synced_at', 'gateway_last_error',
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


class ProjectServiceSerializer(serializers.ModelSerializer):
    """Serializer for routable project services."""

    class Meta:
        model = ProjectService
        fields = [
            'id',
            'site',
            'name',
            'container_name',
            'internal_port',
            'protocol',
            'is_active',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'site']

    def validate_container_name(self, value: str):
        import re
        if not re.match(r'^[a-zA-Z0-9][a-zA-Z0-9_.-]*$', value):
            raise serializers.ValidationError(
                "Container name can only contain letters, numbers, dots, underscores, and hyphens."
            )
        return value

    def validate_internal_port(self, value: int):
        if not 1 <= int(value) <= 65535:
            raise serializers.ValidationError("internal_port must be between 1 and 65535.")
        return value


class ApiRouteSerializer(serializers.ModelSerializer):
    """Serializer for project API routes."""

    service_name = serializers.CharField(source='service.name', read_only=True)
    container_name = serializers.CharField(source='service.container_name', read_only=True)
    internal_port = serializers.IntegerField(source='service.internal_port', read_only=True)

    class Meta:
        model = ApiRoute
        fields = [
            'id',
            'site',
            'service',
            'service_name',
            'container_name',
            'internal_port',
            'path',
            'strip_prefix',
            'is_enabled',
            'created_by',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'site', 'created_by']

    def validate_path(self, value: str):
        try:
            return normalize_api_route_path(value)
        except ValueError as exc:
            raise serializers.ValidationError(str(exc)) from exc

    def validate(self, attrs):
        attrs = super().validate(attrs)
        site = self.context.get('site')
        service = attrs.get('service') or getattr(self.instance, 'service', None)

        if site is not None and service is not None and service.site_id != site.id:
            raise serializers.ValidationError({'service': 'Service must belong to the same project.'})

        return attrs


class GatewayApplyJobSerializer(serializers.ModelSerializer):
    requested_by_username = serializers.CharField(source='requested_by.username', read_only=True)

    class Meta:
        model = GatewayApplyJob
        fields = [
            'id',
            'status',
            'reason',
            'error',
            'worker_id',
            'requested_by',
            'requested_by_username',
            'scheduled_for',
            'started_at',
            'finished_at',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields
