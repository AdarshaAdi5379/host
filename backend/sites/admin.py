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
)

admin.site.register(WordPressSite)
admin.site.register(CustomDomain)
admin.site.register(ProjectMembership)
admin.site.register(AuditLog)
admin.site.register(UserProfile)
admin.site.register(ProjectService)
admin.site.register(ApiRoute)
admin.site.register(GatewayApplyJob)
