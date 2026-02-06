from django.urls import path, include
from .views import GoogleLogin, UserProfileView

urlpatterns = [
    # Password auth endpoints (provided by dj-rest-auth)
    path('register/', include('dj_rest_auth.registration.urls')),
    path('', include('dj_rest_auth.urls')),  # Includes login/, logout/, user/ etc. at the root
    
    # Google OAuth
    path('google/', GoogleLogin.as_view(), name='google_login'),
    
    # User profile
    path('user/', UserProfileView.as_view(), name='user_profile'),
]
