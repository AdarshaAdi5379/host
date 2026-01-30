import sys
import os
from pathlib import Path

# Add backend to path to import nginx_manager
sys.path.append(os.path.join(os.getcwd(), 'backend'))

try:
    from sites import nginx_manager
    
    print("Checking Nginx Status...")
    nginx_path = nginx_manager.get_nginx_path()
    
    if not nginx_path:
        print("ERROR: Nginx not found!")
    else:
        print(f"Nginx found at: {nginx_path}")
        
        # Check sites directory
        sites_dir = nginx_path / "conf" / "sites"
        if not sites_dir.exists():
            print(f"Sites directory missing: {sites_dir}")
        else:
            print(f"Sites directory exists: {sites_dir}")
            files = list(sites_dir.glob("*.conf"))
            if not files:
                print("No site configs found in sites directory.")
            else:
                print(f"Found {len(files)} config(s):")
                for f in files:
                    print(f" - {f.name}")
                    
        # Check if running
        if nginx_manager.is_nginx_running():
            print("Nginx is currently running.")
        else:
            print("Nginx is NOT running.")

except ImportError as e:
    print(f"Import Error: {e}")
except Exception as e:
    print(f"Error: {e}")
