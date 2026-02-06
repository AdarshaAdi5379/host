from allauth.socialaccount.providers.google.views import GoogleOAuth2Adapter
from allauth.socialaccount.providers.oauth2.client import OAuth2Client
from dj_rest_auth.registration.views import SocialLoginView
from knox.models import AuthToken
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth import get_user_model

def create_knox_token(token_model, user, serializer):
    """
    Custom token creator for Knox.
    
    dj-rest-auth's default token creator uses get_or_create which is incompatible
    with Knox's token model. This function creates a new Knox token properly.
    """
    instance, token = AuthToken.objects.create(user=user)
    instance.key = token  # Attach raw token so dj-rest-auth can serialize it
    return instance

User = get_user_model()


class GoogleLogin(SocialLoginView):
    """
    Google OAuth2 login endpoint.
    Accepts authorization code from Google and returns Knox token.
    """
    adapter_class = GoogleOAuth2Adapter
    callback_url = "http://localhost:5173/auth/google/callback"
    client_class = OAuth2Client


class UserProfileView(APIView):
    """
    Get authenticated user's profile information.
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        user = request.user
        return Response({
            'id': user.id,
            'email': user.email,
            'username': user.username if user.username else user.email.split('@')[0],
            'first_name': user.first_name,
            'last_name': user.last_name,
            'name': user.get_full_name() or user.email.split('@')[0],
            'role': 'owner' if user.is_staff else 'user',
            'emailVerified': user.email is not None,
            'createdAt': user.date_joined.isoformat() if hasattr(user, 'date_joined') else None,
            'lastLoginAt': user.last_login.isoformat() if user.last_login else None,
        })
