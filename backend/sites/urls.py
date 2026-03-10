from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    WordPressSiteViewSet, CustomDomainViewSet, ProjectTeamViewSet,
    AuditLogViewSet, SuperAdminViewSet, UserProfileViewSet
)
from .compute_views import (
    ComputeImageViewSet,
    ComputeFlavorViewSet,
    SSHKeyPairViewSet,
    SecurityGroupViewSet,
    ComputeInstanceViewSet,
    ComputeOperationViewSet,
    ComputeEventViewSet,
)

router = DefaultRouter()
router.register(r'sites', WordPressSiteViewSet, basename='wordpress-site')
router.register(r'domains', CustomDomainViewSet, basename='custom-domain')
router.register(r'team', ProjectTeamViewSet, basename='project-team')
router.register(r'audit-logs', AuditLogViewSet, basename='audit-log')
router.register(r'admin', SuperAdminViewSet, basename='super-admin')
router.register(r'profile', UserProfileViewSet, basename='user-profile')
router.register(r'compute-images', ComputeImageViewSet, basename='compute-image')
router.register(r'compute-flavors', ComputeFlavorViewSet, basename='compute-flavor')
router.register(r'ssh-keys', SSHKeyPairViewSet, basename='ssh-key')
router.register(r'security-groups', SecurityGroupViewSet, basename='security-group')
router.register(r'compute-instances', ComputeInstanceViewSet, basename='compute-instance')
router.register(r'compute-operations', ComputeOperationViewSet, basename='compute-operation')
router.register(r'compute-events', ComputeEventViewSet, basename='compute-event')

urlpatterns = [
    path('', include(router.urls)),
]
