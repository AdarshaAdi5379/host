import os
import django
import sys

# Setup Django environment
sys.path.append('/home/adarsha/Desktop/projects/HOST/host/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from sites.models import WordPressSite
import requests

sites = WordPressSite.objects.all()
print(f"Found {sites.count()} sites in DB.")

for site in sites:
    url = f"http://localhost:{site.port}"
    print(f"Testing {site.name} at {url} (status={site.status})...")
    try:
        response = requests.get(url, timeout=5)
        print(f"  Result: {response.status_code}")
    except Exception as e:
        print(f"  Error: {e}")
