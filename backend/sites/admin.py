from django.contrib import admin
from .models import (
    WordPressSite,
    CustomDomain,
    ProjectMembership,
    AuditLog,
    UserProfile,
    ProjectService,
    ApiRoute,
    GatewayApplyJob,
    ComputeImage,
    ComputeFlavor,
    SSHKeyPair,
    SecurityGroup,
    SecurityGroupRule,
    ComputeInstance,
    ComputeOperation,
    ComputeEvent,
)

admin.site.register(WordPressSite)
admin.site.register(CustomDomain)
admin.site.register(ProjectMembership)
admin.site.register(AuditLog)
admin.site.register(UserProfile)
admin.site.register(ProjectService)
admin.site.register(ApiRoute)
admin.site.register(GatewayApplyJob)
admin.site.register(ComputeImage)
admin.site.register(ComputeFlavor)
admin.site.register(SSHKeyPair)
admin.site.register(SecurityGroup)
admin.site.register(SecurityGroupRule)
admin.site.register(ComputeInstance)
admin.site.register(ComputeOperation)
admin.site.register(ComputeEvent)
