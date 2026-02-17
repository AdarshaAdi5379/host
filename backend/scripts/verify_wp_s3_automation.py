import os
import sys
import requests
import time
import subprocess
import json

# Add backend directory to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

import django
django.setup()

from sites.models import WordPressSite

BASE_URL = "http://localhost:8000/api"
# Use a unique name to avoid volume persistence issues from previous runs
import time
timestamp = int(time.time())
SITE_NAME = f"test_s3_{timestamp}"
DB_PASSWORD = "TestPassword123!"

def create_test_site():
    print(f"Creating test site: {SITE_NAME}...")
    
    # 1. DELETE EXISTING IF ANY
    try:
        existing = WordPressSite.objects.get(name=SITE_NAME)
        print(f"Found existing site {SITE_NAME}, deleting...")
        requests.delete(f"{BASE_URL}/sites/{existing.id}/terminate/")
        time.sleep(5)
    except WordPressSite.DoesNotExist:
        pass

    # 2. CREATE NEW SITE
    payload = {
        "name": SITE_NAME,
        "db_password": DB_PASSWORD,
        "admin_username": "admin",
        "admin_password": "SecurePassword123!"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/sites/", json=payload)
        if response.status_code == 201:
            site_data = response.json()
            print(f"✅ Site created successfully. ID: {site_data['id']}")
            return site_data
        else:
            print(f"❌ Failed to create site: {response.text}")
            return None
    except Exception as e:
        print(f"❌ Error creating site: {e}")
        return None

def verify_s3_configuration(site_name):
    print(f"\nVerifying S3 Configuration for {site_name}...")
    container_name = f"{site_name}_wp"
    
    try:
        # 1. CHECK PLUGIN ACTIVE
        print("Checking plugin status...")
        cmd_plugin = ['docker', 'exec', container_name, 'wp', 'plugin', 'is-active', 'ilab-media-tools', '--allow-root']
        result_plugin = subprocess.run(cmd_plugin, capture_output=True, text=True)
        
        if result_plugin.returncode == 0:
            print("✅ Plugin 'ilab-media-tools' is ACTIVE.")
        else:
            print("❌ Plugin is NOT active.")
            return False

        # 2. CHECK SETTINGS via WP Options
        print("Checking Media Cloud settings...")
        settings_to_check = {
            'mcloud-storage-provider': 's3',
            'mcloud-storage-s3-endpoint': 'http://host.docker.internal:9300',
            'mcloud-storage-s3-bucket': 'hostinger-uploads',
            # 'mcloud-storage-upload-images': '1' 
        }
        
        all_passed = True
        for key, expected_value in settings_to_check.items():
            cmd_setting = ['docker', 'exec', container_name, 'wp', 'option', 'get', key, '--allow-root']
            result_setting = subprocess.run(cmd_setting, capture_output=True, text=True)
            actual_value = result_setting.stdout.strip()
            
            if result_setting.returncode != 0:
                 print(f"❌ Option '{key}' verification failed (Command Error): {result_setting.stderr.strip()}")
                 all_passed = False
                 continue

            if actual_value != expected_value:
                print(f"❌ {key} Mismatch! Expected: {expected_value}, Got: {actual_value}")
                all_passed = False
            else:
                print(f"✅ {key}: {actual_value}")
        
        return all_passed

    except Exception as e:
        print(f"❌ Verification Error: {e}")
        return False

if __name__ == "__main__":
    site = create_test_site()
    if site:
        # Give it a moment for the background tasks/configs to settle if any (though ours is synchronous in view)
        verify_success = verify_s3_configuration(SITE_NAME)
        
        if verify_success:
            print("\n🎉 SUCCESS: WordPress S3 Automation Verified!")
            sys.exit(0)
        else:
            print("\nfailed: Configuration mismatch.")
            sys.exit(1)
    else:
        sys.exit(1)
