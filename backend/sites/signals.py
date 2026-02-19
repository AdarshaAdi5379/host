"""
Django signals for WordPress site lifecycle events
"""
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth.models import User
from django.contrib.auth.signals import user_logged_in, user_logged_out
from .models import WordPressSite, UserProfile, ProjectMembership
from .audit_logger import AuditLogger
import subprocess
import threading
import logging

logger = logging.getLogger(__name__)


def sync_filebrowser_credentials_async(site_id):
    """
    Run FileBrowser sync command asynchronously in background thread
    This prevents blocking the site creation response
    """
    try:
        # Wait a bit for site containers to fully start
        import time
        time.sleep(2)
        
        # Run the sync command for this specific site
        from .models import WordPressSite
        site = WordPressSite.objects.get(id=site_id)
        
        # Only sync if credentials are missing
        if site.filebrowser_username:
            logger.info(f"Site {site.name} already has FileBrowser credentials, skipping sync")
            return
        
        logger.info(f"Starting FileBrowser sync for site: {site.name}")
        
        result = subprocess.run(
            ['python', 'manage.py', 'sync_filebrowser_users', '--site', site.name],
            cwd='/home/adarsha/Desktop/projects/HOST/host/backend',
            capture_output=True,
            text=True,
            timeout=60
        )
        
        if result.returncode == 0:
            logger.info(f"✅ FileBrowser credentials synced for {site.name}")
        else:
            logger.error(f"❌ FileBrowser sync failed for {site.name}: {result.stderr}")
            
    except Exception as e:
        logger.error(f"Error syncing FileBrowser credentials: {str(e)}")


@receiver(post_save, sender=WordPressSite)
def create_filebrowser_user(sender, instance, created, **kwargs):
    """
    Signal handler to create FileBrowser user after site creation
    Runs asynchronously to avoid blocking the response
    """
    if created:
        # Only trigger for new sites
        logger.info(f"New site created: {instance.name}, scheduling FileBrowser sync")
        
        # Run sync in background thread to avoid blocking
        thread = threading.Thread(
            target=sync_filebrowser_credentials_async,
            args=(instance.id,)
        )
        thread.daemon = True
        thread.start()


@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    """
    Automatically create UserProfile when a new user is created
    """
    if created:
        UserProfile.objects.create(
            user=instance,
            platform_role='user',
            project_quota=5
        )
        logger.info(f"UserProfile created for user: {instance.email}")


@receiver(post_save, sender=WordPressSite)
def create_owner_membership(sender, instance, created, **kwargs):
    """
    Automatically create ProjectMembership for the site owner
    """
    if created and instance.owner:
        # Check if membership already exists
        if not ProjectMembership.objects.filter(project=instance, user=instance.owner).exists():
            ProjectMembership.objects.create(
                project=instance,
                user=instance.owner,
                role='owner',
                invited_by=instance.owner
            )
            logger.info(f"Owner membership created for {instance.owner.email} on project {instance.name}")


@receiver(user_logged_in)
def log_user_login(sender, request, user, **kwargs):
    """
    Log user login event
    """
    AuditLogger.log_login(user=user, request=request)
    logger.info(f"User logged in: {user.email}")


@receiver(user_logged_out)
def log_user_logout(sender, request, user, **kwargs):
    """
    Log user logout event
    """
    if user:
        AuditLogger.log_logout(user=user, request=request)
        logger.info(f"User logged out: {user.email}")
