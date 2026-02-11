"""
Django signals for WordPress site lifecycle events
"""
from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import WordPressSite
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
