import os
import sys
import django
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage

# Setup Django Environment
# Assuming cwd is /home/adarsha/Desktop/projects/HOST/host/backend
if str(os.getcwd()) not in sys.path:
    sys.path.append(str(os.getcwd()))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

def verify_minio_upload():
    print("--- Starting MinIO Upload Verification ---")
    
    filename = 'test_upload_verify.txt'
    content = b'This is a test file uploaded from Django to MinIO.'
    
    print(f"Attempting to upload '{filename}'...")
    
    try:
        # Save file
        path = default_storage.save(filename, ContentFile(content))
        print(f"SUCCESS: File saved to path: {path}")
        
        # Get URL
        url = default_storage.url(path)
        print(f"File URL: {url}")
        
        # Verify content (optional, by reading back)
        if default_storage.exists(path):
            print("SUCCESS: File exists in storage.")
            
            # Clean up
            print("Cleaning up...")
            default_storage.delete(path)
            print("Test file deleted.")
            return True
        else:
            print("FAIL: File was saved but does not exist in storage?")
            return False
            
    except Exception as e:
        print(f"FAIL: Error during upload: {e}")
        return False

if __name__ == "__main__":
    if verify_minio_upload():
        print("\n✅ Verification Passed: Django can write to MinIO.")
        sys.exit(0)
    else:
        print("\n❌ Verification Failed.")
        sys.exit(1)
