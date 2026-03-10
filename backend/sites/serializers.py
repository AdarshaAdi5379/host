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
    ComputeImage,
    ComputeFlavor,
    SSHKeyPair,
    SecurityGroup,
    SecurityGroupRule,
    ComputeInstance,
    ComputeOperation,
    ComputeEvent,
)
from .gateway_routing import normalize_api_route_path


class WordPressSiteSerializer(serializers.ModelSerializer):
    """Serializer for WordPress site listing"""
    db_active_target = serializers.SerializerMethodField()
    db_failover_enabled = serializers.SerializerMethodField()
    db_replication_state = serializers.SerializerMethodField()
    
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
            # DR fields
            'db_active_target', 'db_failover_enabled', 'db_replication_state',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'port', 'domain', 'owner']
    
    owner = serializers.CharField(source='owner.username', read_only=True, allow_null=True, required=False)

    def _dr_config(self, obj) -> dict:
        cfg = obj.db_dr_config or {}
        if isinstance(cfg, dict):
            return cfg
        return {}

    def get_db_active_target(self, obj):
        return self._dr_config(obj).get('active_target', 'local')

    def get_db_failover_enabled(self, obj):
        return bool(self._dr_config(obj).get('enabled', False))

    def get_db_replication_state(self, obj):
        return self._dr_config(obj).get('replication_state', 'not_configured')



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


class RDSFailoverConfigSerializer(serializers.Serializer):
    """Serializer for site-level RDS DR/failover config."""

    enabled = serializers.BooleanField(required=False)
    active_target = serializers.ChoiceField(choices=['local', 'rds'], required=False, read_only=True)
    rds_endpoint = serializers.CharField(max_length=255, required=False, allow_blank=True)
    rds_port = serializers.IntegerField(required=False, min_value=1, max_value=65535)
    rds_database = serializers.CharField(max_length=100, required=False, allow_blank=True)
    rds_username = serializers.CharField(max_length=100, required=False, allow_blank=True)
    rds_password = serializers.CharField(max_length=255, required=False, allow_blank=True, write_only=True)
    rds_password_set = serializers.BooleanField(required=False, read_only=True)
    rds_ssl_required = serializers.BooleanField(required=False)
    source_public_host = serializers.CharField(max_length=255, required=False, allow_blank=True)
    source_public_port = serializers.IntegerField(required=False, min_value=1, max_value=65535)
    replication_user = serializers.CharField(max_length=100, required=False, allow_blank=True)
    replication_password = serializers.CharField(max_length=255, required=False, allow_blank=True, write_only=True)
    replication_password_set = serializers.BooleanField(required=False, read_only=True)
    replication_state = serializers.ChoiceField(
        choices=['not_configured', 'configured', 'running', 'error', 'promoted'],
        required=False,
    )
    replication_last_error = serializers.CharField(required=False, allow_blank=True)
    last_failover_at = serializers.CharField(required=False, read_only=True)
    last_failback_at = serializers.CharField(required=False, read_only=True)


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


class ComputeImageSerializer(serializers.ModelSerializer):
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model = ComputeImage
        fields = [
            'id',
            'name',
            'version',
            'source_url',
            'checksum_sha256',
            'local_path',
            'os_family',
            'minimum_disk_gb',
            'is_active',
            'is_default',
            'created_by',
            'created_by_username',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_by', 'created_by_username', 'created_at', 'updated_at']


class ComputeFlavorSerializer(serializers.ModelSerializer):
    class Meta:
        model = ComputeFlavor
        fields = [
            'id',
            'name',
            'vcpu',
            'memory_mb',
            'disk_gb',
            'is_active',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class SSHKeyPairSerializer(serializers.ModelSerializer):
    owner_username = serializers.CharField(source='owner.username', read_only=True)

    class Meta:
        model = SSHKeyPair
        fields = [
            'id',
            'owner',
            'owner_username',
            'name',
            'public_key',
            'fingerprint',
            'is_active',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'owner', 'owner_username', 'fingerprint', 'created_at', 'updated_at']


class SecurityGroupRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = SecurityGroupRule
        fields = [
            'id',
            'security_group',
            'direction',
            'protocol',
            'from_port',
            'to_port',
            'cidr',
            'description',
            'is_active',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'security_group', 'created_at', 'updated_at']


class SecurityGroupSerializer(serializers.ModelSerializer):
    owner_username = serializers.CharField(source='owner.username', read_only=True)
    rules = SecurityGroupRuleSerializer(many=True, read_only=True)

    class Meta:
        model = SecurityGroup
        fields = [
            'id',
            'owner',
            'owner_username',
            'name',
            'description',
            'is_default',
            'rules',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'owner', 'owner_username', 'rules', 'created_at', 'updated_at']


class ComputeInstanceSerializer(serializers.ModelSerializer):
    owner_username = serializers.CharField(source='owner.username', read_only=True)
    image_name = serializers.CharField(source='image.name', read_only=True)
    image_version = serializers.CharField(source='image.version', read_only=True)
    flavor_name = serializers.CharField(source='flavor.name', read_only=True)
    ssh_key_name = serializers.CharField(source='ssh_key.name', read_only=True, allow_null=True)
    security_groups = SecurityGroupSerializer(many=True, read_only=True)

    class Meta:
        model = ComputeInstance
        fields = [
            'id',
            'name',
            'instance_id',
            'owner',
            'owner_username',
            'state',
            'desired_state',
            'private_ip',
            'public_ip',
            'image',
            'image_name',
            'image_version',
            'flavor',
            'flavor_name',
            'ssh_key',
            'ssh_key_name',
            'security_groups',
            'libvirt_domain_name',
            'libvirt_domain_uuid',
            'disk_path',
            'seed_iso_path',
            'cloud_init_completed',
            'last_error',
            'metadata',
            'launched_at',
            'terminated_at',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'instance_id',
            'owner',
            'owner_username',
            'state',
            'private_ip',
            'public_ip',
            'image_name',
            'image_version',
            'flavor_name',
            'ssh_key_name',
            'security_groups',
            'libvirt_domain_name',
            'libvirt_domain_uuid',
            'disk_path',
            'seed_iso_path',
            'cloud_init_completed',
            'last_error',
            'launched_at',
            'terminated_at',
            'created_at',
            'updated_at',
        ]


class ComputeInstanceCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120)
    image_id = serializers.IntegerField()
    flavor_id = serializers.IntegerField()
    ssh_key_id = serializers.IntegerField()
    security_group_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        required=False,
        allow_empty=True,
    )
    metadata = serializers.JSONField(required=False)

    def validate_name(self, value):
        import re
        if not re.match(r'^[a-zA-Z0-9][a-zA-Z0-9._-]{1,119}$', value):
            raise serializers.ValidationError(
                'Name must start with alphanumeric and contain only letters, numbers, dot, underscore, or hyphen.'
            )
        return value

    def validate(self, attrs):
        user = self.context['request'].user

        try:
            image = ComputeImage.objects.get(id=attrs['image_id'], is_active=True)
        except ComputeImage.DoesNotExist as exc:
            raise serializers.ValidationError({'image_id': 'Active image not found.'}) from exc

        try:
            flavor = ComputeFlavor.objects.get(id=attrs['flavor_id'], is_active=True)
        except ComputeFlavor.DoesNotExist as exc:
            raise serializers.ValidationError({'flavor_id': 'Active flavor not found.'}) from exc

        try:
            ssh_key = SSHKeyPair.objects.get(id=attrs['ssh_key_id'], owner=user, is_active=True)
        except SSHKeyPair.DoesNotExist as exc:
            raise serializers.ValidationError({'ssh_key_id': 'SSH key not found for current user.'}) from exc

        group_ids = attrs.get('security_group_ids', [])
        groups = list(SecurityGroup.objects.filter(owner=user, id__in=group_ids))
        if len(groups) != len(set(group_ids)):
            raise serializers.ValidationError({'security_group_ids': 'One or more security groups are invalid for this user.'})

        if ComputeInstance.objects.filter(owner=user, name=attrs['name']).exists():
            raise serializers.ValidationError({'name': 'Instance name already exists for this user.'})

        attrs['image'] = image
        attrs['flavor'] = flavor
        attrs['ssh_key'] = ssh_key
        attrs['security_groups'] = groups
        return attrs


class ComputeOperationSerializer(serializers.ModelSerializer):
    requested_by_username = serializers.CharField(source='requested_by.username', read_only=True)
    instance_id = serializers.CharField(source='instance.instance_id', read_only=True)
    instance_name = serializers.CharField(source='instance.name', read_only=True)

    class Meta:
        model = ComputeOperation
        fields = [
            'id',
            'instance',
            'instance_id',
            'instance_name',
            'operation',
            'status',
            'request_payload',
            'result_payload',
            'idempotency_key',
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


class ComputeEventSerializer(serializers.ModelSerializer):
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    operation_type = serializers.CharField(source='operation.operation', read_only=True)

    class Meta:
        model = ComputeEvent
        fields = [
            'id',
            'instance',
            'operation',
            'operation_type',
            'event_type',
            'message',
            'metadata',
            'created_by',
            'created_by_username',
            'created_at',
        ]
        read_only_fields = fields
