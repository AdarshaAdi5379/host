from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import WordPressSiteViewSet

router = DefaultRouter()
router.register(r'sites', WordPressSiteViewSet, basename='wordpress-site')

urlpatterns = [
    path('', include(router.urls)),
]
