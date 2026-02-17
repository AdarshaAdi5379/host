from rest_framework import serializers
from .models import WordPressSite, CustomDomain


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
