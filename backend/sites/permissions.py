"""
RBAC Permission Classes for the HOST Platform

Implements 3-Tier Hierarchy:
- Super Admin: Full platform access
- Site Owner: Full access to their projects + team management
- Collaborator: Limited access to assigned projects (no delete, no team management)
"""

from rest_framework import permissions
from .models import ProjectMembership, UserProfile


class IsSuperAdmin(permissions.BasePermission):
    """
    Permission to only allow super admins.
    """
    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            hasattr(request.user, 'profile') and
            request.user.profile.is_super_admin
        )


class IsSiteOwner(permissions.BasePermission):
    """
    Permission to only allow site owners (or super admins).
    Checks if user is the owner of the project.
    """
    def has_object_permission(self, request, view, obj):
        # Super admins can do anything
        if hasattr(request.user, 'profile') and request.user.profile.is_super_admin:
            return True
        
        # Check if user is the owner of the project
        if hasattr(obj, 'owner'):
            return obj.owner == request.user
        
        # For ProjectMembership objects, check if user is owner of the project
        if hasattr(obj, 'project'):
            try:
                membership = ProjectMembership.objects.get(
                    project=obj.project,
                    user=request.user,
                    role='owner'
                )
                return True
            except ProjectMembership.DoesNotExist:
                return False
        
        return False


class IsProjectMember(permissions.BasePermission):
    """
    Permission to allow any project member (owner or collaborator).
    Used for read-only or basic operations.
    """
    def has_object_permission(self, request, view, obj):
        # Super admins can do anything
        if hasattr(request.user, 'profile') and request.user.profile.is_super_admin:
            return True
        
        # Get the project from the object
        project = getattr(obj, 'project', obj)
        
        # Check if user is a member of the project
        return ProjectMembership.objects.filter(
            project=project,
            user=request.user
        ).exists()


class IsProjectOwnerOrReadOnly(permissions.BasePermission):
    """
    Permission that allows read access to collaborators,
    but write access only to owners.
    """
    def has_object_permission(self, request, view, obj):
        # Super admins can do anything
        if hasattr(request.user, 'profile') and request.user.profile.is_super_admin:
            return True
        
        # Get the project from the object
        project = getattr(obj, 'project', obj)
        
        # Safe methods allow any member
        if request.method in permissions.SAFE_METHODS:
            return ProjectMembership.objects.filter(
                project=project,
                user=request.user
            ).exists()
        
        # Write methods require owner role
        try:
            membership = ProjectMembership.objects.get(
                project=project,
                user=request.user,
                role='owner'
            )
            return True
        except ProjectMembership.DoesNotExist:
            return False


class CanManageTeam(permissions.BasePermission):
    """
    Permission to manage team members (invite/remove).
    Only project owners and super admins.
    """
    def has_object_permission(self, request, view, obj):
        # Super admins can do anything
        if hasattr(request.user, 'profile') and request.user.profile.is_super_admin:
            return True
        
        # Get the project
        project = getattr(obj, 'project', obj)
        
        # Only owners can manage team
        try:
            membership = ProjectMembership.objects.get(
                project=project,
                user=request.user,
                role='owner'
            )
            return True
        except ProjectMembership.DoesNotExist:
            return False


class CanDeleteProject(permissions.BasePermission):
    """
    Strict permission for project deletion.
    Only owners (not collaborators) and super admins.
    """
    def has_object_permission(self, request, view, obj):
        # Super admins can do anything
        if hasattr(request.user, 'profile') and request.user.profile.is_super_admin:
            return True
        
        # Only the owner can delete, not collaborators
        if hasattr(obj, 'owner'):
            return obj.owner == request.user
        
        return False


class CanStartStopContainer(permissions.BasePermission):
    """
    Permission to start/stop containers.
    Allowed for: Super Admin, Site Owner, Collaborator
    """
    def has_object_permission(self, request, view, obj):
        # Super admins can do anything
        if hasattr(request.user, 'profile') and request.user.profile.is_super_admin:
            return True
        
        # Get the project
        project = getattr(obj, 'project', obj)
        
        # Any project member can start/stop
        return ProjectMembership.objects.filter(
            project=project,
            user=request.user
        ).exists()


class CanAccessTerminal(permissions.BasePermission):
    """
    Permission to access terminal/logs.
    Allowed for: Super Admin, Site Owner, Collaborator
    """
    def has_object_permission(self, request, view, obj):
        # Super admins can do anything
        if hasattr(request.user, 'profile') and request.user.profile.is_super_admin:
            return True
        
        # Get the project
        project = getattr(obj, 'project', obj)
        
        # Any project member can access terminal
        return ProjectMembership.objects.filter(
            project=project,
            user=request.user
        ).exists()


class CanManageEnvironment(permissions.BasePermission):
    """
    Permission to manage environment variables.
    Owners: Full access
    Collaborators: View only (read-only)
    """
    def has_object_permission(self, request, view, obj):
        # Super admins can do anything
        if hasattr(request.user, 'profile') and request.user.profile.is_super_admin:
            return True
        
        # Get the project
        project = getattr(obj, 'project', obj)
        
        # Read access for any member
        if request.method in permissions.SAFE_METHODS:
            return ProjectMembership.objects.filter(
                project=project,
                user=request.user
            ).exists()
        
        # Write access only for owners
        try:
            membership = ProjectMembership.objects.get(
                project=project,
                user=request.user,
                role='owner'
            )
            return True
        except ProjectMembership.DoesNotExist:
            return False


class HasProjectQuota(permissions.BasePermission):
    """
    Permission to check if user can create more projects.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Super admins have unlimited quota
        if hasattr(request.user, 'profile') and request.user.profile.is_super_admin:
            return True
        
        # Check if user can create project
        if hasattr(request.user, 'profile'):
            return request.user.profile.can_create_project
        
        return False
