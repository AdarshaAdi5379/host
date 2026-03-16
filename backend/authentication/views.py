from allauth.socialaccount.providers.google.views import GoogleOAuth2Adapter
from allauth.socialaccount.providers.oauth2.client import OAuth2Client, OAuth2Error
from dj_rest_auth.registration.views import SocialLoginView, RegisterView
from dj_rest_auth.app_settings import api_settings
from allauth.account import app_settings as allauth_settings
from knox.models import AuthToken
from rest_framework import status as http_status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError
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


class CustomRegisterView(RegisterView):
    """
    Custom RegisterView to handle Knox token generation.
    dj-rest-auth default RegisterView assumes user.auth_token exists,
    which fails with Knox.
    """

    def get_response_data(self, user):
        if (
            allauth_settings.EMAIL_VERIFICATION
            == allauth_settings.EmailVerificationMethod.MANDATORY
        ):
            return {"detail": "Verification e-mail sent."}

        # Create Knox token explicitly
        token = create_knox_token(None, user, None)

        # Serialize using our configured TOKEN_SERIALIZER (KnoxTokenSerializer)
        return api_settings.TOKEN_SERIALIZER(
            token, context=self.get_serializer_context()
        ).data


class GoogleLogin(SocialLoginView):
    """
    Google OAuth2 login endpoint.

    Accepts access_token + id_token obtained from Google's implicit flow
    (response_type=token id_token) and returns a Knox session token.

    The frontend uses response_type=token id_token so that Google delivers
    both tokens directly in the URL hash fragment — no server-side code
    exchange is needed, which avoids the allauth 0.57 / dj-rest-auth 5 bug
    where OAuth2Error from complete_login() was not caught and caused a 500.
    """

    adapter_class = GoogleOAuth2Adapter
    callback_url = "http://localhost:5173/auth/google/callback"
    client_class = OAuth2Client

    def post(self, request, *args, **kwargs):
        try:
            return super().post(request, *args, **kwargs)
        except OAuth2Error as exc:
            # allauth raises OAuth2Error (e.g. "Invalid id_token") inside
            # complete_login(), but dj-rest-auth's SocialLoginSerializer does
            # not catch it, so it propagates as an unhandled exception → 500.
            # We catch it here and convert it to a clean 400.
            raise ValidationError({"non_field_errors": [str(exc)]}) from exc


class UserProfileView(APIView):
    """
    Get authenticated user's profile information.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        # Get profile data safely
        project_quota = 5
        platform_role = (
            "super_admin" if getattr(user, "is_superuser", False) else "user"
        )

        if hasattr(user, "profile"):
            if user.is_superuser:
                project_quota = 0
                platform_role = "super_admin"
            else:
                project_quota = user.profile.project_quota
                platform_role = user.profile.platform_role

        return Response(
            {
                "id": user.id,
                "email": user.email,
                "username": user.username
                if user.username
                else user.email.split("@")[0],
                "first_name": user.first_name,
                "last_name": user.last_name,
                "name": user.get_full_name() or user.email.split("@")[0],
                "role": "owner" if user.is_staff else "user",
                "project_quota": project_quota,
                "platform_role": platform_role,
                "emailVerified": user.email is not None,
                "createdAt": user.date_joined.isoformat()
                if hasattr(user, "date_joined")
                else None,
                "lastLoginAt": user.last_login.isoformat() if user.last_login else None,
            }
        )
