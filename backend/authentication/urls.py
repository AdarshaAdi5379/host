from django.urls import path, include
from .views import GoogleLogin, UserProfileView, CustomRegisterView

urlpatterns = [
    # Override default registration view to fix Knox token compatibility
    path('register/', CustomRegisterView.as_view(), name='rest_register'),
    # Include other registration endpoints (verify-email, etc)
    path('register/', include('dj_rest_auth.registration.urls')),
    path('', include('dj_rest_auth.urls')),  # Includes login/, logout/, user/ etc. at the root
    
    # Google OAuth
    path('google/', GoogleLogin.as_view(), name='google_login'),
    
    # User profile
    path('user/', UserProfileView.as_view(), name='user_profile'),
]
