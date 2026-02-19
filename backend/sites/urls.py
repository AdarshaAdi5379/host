from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    WordPressSiteViewSet, CustomDomainViewSet, ProjectTeamViewSet,
    AuditLogViewSet, SuperAdminViewSet, UserProfileViewSet
)

router = DefaultRouter()
router.register(r'sites', WordPressSiteViewSet, basename='wordpress-site')
router.register(r'domains', CustomDomainViewSet, basename='custom-domain')
router.register(r'team', ProjectTeamViewSet, basename='project-team')
router.register(r'audit-logs', AuditLogViewSet, basename='audit-log')
router.register(r'admin', SuperAdminViewSet, basename='super-admin')
router.register(r'profile', UserProfileViewSet, basename='user-profile')

urlpatterns = [
    path('', include(router.urls)),
]
