from rest_framework import serializers
from .models import WordPressSite


class WordPressSiteSerializer(serializers.ModelSerializer):
    """Serializer for WordPress site listing"""
    
    class Meta:
        model = WordPressSite
        fields = [
            'id', 'name', 'domain', 'port', 'status', 
            'created_at', 'updated_at', 'admin_username'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'port', 'domain']


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
