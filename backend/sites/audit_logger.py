"""
Audit Logging Utility for the HOST Platform

Provides centralized logging for all user actions across the platform.
"""

from .models import AuditLog


class AuditLogger:
    """Helper class for creating audit log entries"""
    
    @staticmethod
    def log(user, action, project=None, description='', request=None, metadata=None):
        """
        Create an audit log entry.
        
        Args:
            user: The user performing the action
            action: The action type (from AuditLog.ACTION_CHOICES)
            project: Optional project associated with the action
            description: Human-readable description
            request: Optional HTTP request to extract IP and user agent
            metadata: Optional dict with additional context
        """
        ip_address = None
        user_agent = ''
        
        if request:
            # Get IP address
            x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
            if x_forwarded_for:
                ip_address = x_forwarded_for.split(',')[0].strip()
            else:
                ip_address = request.META.get('REMOTE_ADDR')
            
            # Get user agent
            user_agent = request.META.get('HTTP_USER_AGENT', '')
        
        return AuditLog.objects.create(
            user=user,
            project=project,
            action=action,
            description=description,
            ip_address=ip_address,
            user_agent=user_agent,
            metadata=metadata or {}
        )
    
    @staticmethod
    def log_project_created(user, project, request=None):
        """Log when a project is created"""
        return AuditLogger.log(
            user=user,
            action='project_created',
            project=project,
            description=f'Created project "{project.name}"',
            request=request,
            metadata={'project_name': project.name, 'port': project.port}
        )
    
    @staticmethod
    def log_project_deleted(user, project_name, request=None):
        """Log when a project is deleted"""
        return AuditLogger.log(
            user=user,
            action='project_deleted',
            description=f'Deleted project "{project_name}"',
            request=request,
            metadata={'project_name': project_name}
        )
    
    @staticmethod
    def log_project_started(user, project, request=None):
        """Log when a project is started"""
        return AuditLogger.log(
            user=user,
            action='project_started',
            project=project,
            description=f'Started project "{project.name}"',
            request=request
        )
    
    @staticmethod
    def log_project_stopped(user, project, request=None):
        """Log when a project is stopped"""
        return AuditLogger.log(
            user=user,
            action='project_stopped',
            project=project,
            description=f'Stopped project "{project.name}"',
            request=request
        )
    
    @staticmethod
    def log_member_invited(user, project, invited_user, role, request=None):
        """Log when a team member is invited"""
        return AuditLogger.log(
            user=user,
            action='member_invited',
            project=project,
            description=f'Invited {invited_user.email} as {role}',
            request=request,
            metadata={
                'invited_user_email': invited_user.email,
                'invited_user_id': invited_user.id,
                'role': role
            }
        )
    
    @staticmethod
    def log_member_removed(user, project, removed_user, request=None):
        """Log when a team member is removed"""
        return AuditLogger.log(
            user=user,
            action='member_removed',
            project=project,
            description=f'Removed {removed_user.email} from project',
            request=request,
            metadata={
                'removed_user_email': removed_user.email,
                'removed_user_id': removed_user.id
            }
        )
    
    @staticmethod
    def log_backup_created(user, project, backup_file, size_mb, request=None):
        """Log when a backup is created"""
        return AuditLogger.log(
            user=user,
            action='backup_created',
            project=project,
            description=f'Created backup ({size_mb} MB)',
            request=request,
            metadata={'backup_file': backup_file, 'size_mb': size_mb}
        )
    
    @staticmethod
    def log_public_access_enabled(user, project, public_url, request=None):
        """Log when public access is enabled"""
        return AuditLogger.log(
            user=user,
            action='public_access_enabled',
            project=project,
            description=f'Enabled public access at {public_url}',
            request=request,
            metadata={'public_url': public_url}
        )
    
    @staticmethod
    def log_public_access_disabled(user, project, request=None):
        """Log when public access is disabled"""
        return AuditLogger.log(
            user=user,
            action='public_access_disabled',
            project=project,
            description='Disabled public access',
            request=request
        )
    
    @staticmethod
    def log_domain_connected(user, project, domain_name, request=None):
        """Log when a custom domain is connected"""
        return AuditLogger.log(
            user=user,
            action='domain_connected',
            project=project,
            description=f'Connected domain {domain_name}',
            request=request,
            metadata={'domain_name': domain_name}
        )
    
    @staticmethod
    def log_domain_removed(user, project, domain_name, request=None):
        """Log when a custom domain is removed"""
        return AuditLogger.log(
            user=user,
            action='domain_removed',
            project=project,
            description=f'Removed domain {domain_name}',
            request=request,
            metadata={'domain_name': domain_name}
        )
    
    @staticmethod
    def log_container_restart(user, project, request=None):
        """Log when a container is restarted"""
        return AuditLogger.log(
            user=user,
            action='container_restart',
            project=project,
            description=f'Restarted containers for "{project.name}"',
            request=request
        )
    
    @staticmethod
    def log_terminal_access(user, project, request=None):
        """Log when terminal is accessed"""
        return AuditLogger.log(
            user=user,
            action='terminal_access',
            project=project,
            description=f'Accessed terminal for "{project.name}"',
            request=request
        )
    
    @staticmethod
    def log_database_access(user, project, request=None):
        """Log when database is accessed"""
        return AuditLogger.log(
            user=user,
            action='database_access',
            project=project,
            description=f'Accessed database for "{project.name}"',
            request=request
        )
    
    @staticmethod
    def log_file_access(user, project, request=None):
        """Log when file manager is accessed"""
        return AuditLogger.log(
            user=user,
            action='file_access',
            project=project,
            description=f'Accessed file manager for "{project.name}"',
            request=request
        )
    
    @staticmethod
    def log_login(user, request=None):
        """Log user login"""
        return AuditLogger.log(
            user=user,
            action='login',
            description='User logged in',
            request=request
        )
    
    @staticmethod
    def log_logout(user, request=None):
        """Log user logout"""
        return AuditLogger.log(
            user=user,
            action='logout',
            description='User logged out',
            request=request
        )
    
    @staticmethod
    def log_settings_updated(user, project, settings_changed, request=None):
        """Log when settings are updated"""
        return AuditLogger.log(
            user=user,
            action='settings_updated',
            project=project,
            description=f'Updated settings: {", ".join(settings_changed)}',
            request=request,
            metadata={'settings_changed': settings_changed}
        )
