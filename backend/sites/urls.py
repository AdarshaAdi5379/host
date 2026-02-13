from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import WordPressSiteViewSet, CustomDomainViewSet

router = DefaultRouter()
router.register(r'sites', WordPressSiteViewSet, basename='wordpress-site')
router.register(r'domains', CustomDomainViewSet, basename='custom-domain')

urlpatterns = [
    path('', include(router.urls)),
]
