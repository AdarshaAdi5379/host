"""
Script to update FileBrowser credentials in Django database for existing sites
"""
import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from sites.models import WordPressSite

# Credentials mapping (site_name -> credentials)
credentials = {
    'test36': {'username': 'fb_test36', 'password': 'Kx7mP9nQ2vL5wR8t'},
    '35': {'username': 'fb_35', 'password': 'Hy6nM8pQ1uK4vS7r'},
    'test34': {'username': 'fb_test34', 'password': 'Jw5oL7qP9tN3xM6k'},
    'test33': {'username': 'fb_test33', 'password': 'Gz4nK6mR8vB2yL5p'},
}

print("Updating FileBrowser credentials in database...\n")

for site_name, creds in credentials.items():
    try:
        site = WordPressSite.objects.get(name=site_name)
        site.filebrowser_username = creds['username']
        site.filebrowser_password = creds['password']
        site.save()
        print(f"✅ {site_name}: Updated credentials (username: {creds['username']})")
    except WordPressSite.DoesNotExist:
        print(f"❌ {site_name}: Site not found in database")
    except Exception as e:
        print(f"❌ {site_name}: Error - {str(e)}")

print("\n✅ Database update complete!")
