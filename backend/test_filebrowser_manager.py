"""
Test script for the new SQLite-based FileBrowserManager
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from sites.filebrowser_manager import FileBrowserManager

# Test creating a user
fb_manager = FileBrowserManager()

print("Testing FileBrowserManager with SQLite...")
print(f"Database path: {fb_manager.DB_PATH}")
print(f"Database exists: {fb_manager.DB_PATH.exists()}\n")

# Generate credentials
creds = fb_manager.generate_credentials("test_auto")
print(f"Generated credentials: {creds}")

# Create user
print("\nCreating FileBrowser user...")
result = fb_manager.create_user("test_auto", creds['username'], creds['password'])
print(f"Result: {result}")

# Check if user exists
if result['success']:
    exists = fb_manager.user_exists(creds['username'])
    print(f"User exists check: {exists}")
    
    # Delete user
    print("\nDeleting test user...")
    delete_result = fb_manager.delete_user(creds['username'])
    print(f"Delete result: {delete_result}")
    
    # Verify deletion
    exists_after = fb_manager.user_exists(creds['username'])
    print(f"User exists after deletion: {exists_after}")

print("\n✅ Test complete!")
