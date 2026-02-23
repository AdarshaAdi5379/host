from rest_framework import serializers
from django.contrib.auth import get_user_model

User = get_user_model()

class KnoxTokenSerializer(serializers.Serializer):
    """
    Serializer for Knox authentication response.
    Expects an instance with 'key' (raw token) and 'user' attributes.
    """
    key = serializers.CharField()
    user = serializers.SerializerMethodField()

    def get_user(self, obj):
        user = obj.user
        
        # Get profile data safely
        project_quota = 5
        platform_role = 'super_admin' if getattr(user, 'is_superuser', False) else 'user'
        
        if hasattr(user, 'profile'):
            if user.is_superuser:
               project_quota = 0
               platform_role = 'super_admin'
            else:
               project_quota = user.profile.project_quota
               platform_role = user.profile.platform_role
            
        return {
            'id': user.id,
            'email': user.email,
            'username': user.username or user.email.split('@')[0],
            'name': user.get_full_name() or user.username or user.email.split('@')[0],
            'first_name': user.first_name,
            'last_name': user.last_name,
            'role': 'owner' if user.is_staff else 'user',
            'project_quota': project_quota,
            'platform_role': platform_role,
        }
