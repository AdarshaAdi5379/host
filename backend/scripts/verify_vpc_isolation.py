import os
import sys
import django
import time
import subprocess
from pathlib import Path

# Setup Django Environment
# Assuming cwd is /home/adarsha/Desktop/projects/HOST/host/backend
if str(Path.cwd()) not in sys.path:
    sys.path.append(str(Path.cwd()))
    sys.path.append(str(Path.cwd().parent)) # For parent access if needed

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from sites.tenant_db_manager import TenantDatabaseManager
from sites.orchestrator import generate_docker_compose, write_docker_compose, create_site_directory, write_wp_config, generate_wp_config_content
from sites.docker_utils import run_docker_compose_up, run_docker_compose_down

SITE_NAME = 'vpc_verify_01'
SITE_PORT = 9991 # Fixed port for test

def cleanup():
    print(f"Cleaning up {SITE_NAME}...")
    site_dir = create_site_directory(SITE_NAME)
    run_docker_compose_down(site_dir)
    # Remove directory? Better keep for inspection if failed.

def verify_vpc():
    print(f"Starting VPC Verification for {SITE_NAME}...")
    
    # 1. Generate Credentials (VPC Flow)
    db_manager = TenantDatabaseManager()
    print("Generating Credentials...")
    db_config = db_manager.generate_credentials(SITE_NAME)
    
    # 2. Setup Files
    print("Creating Directories & Configs...")
    site_dir = create_site_directory(SITE_NAME)
    
    # wp-config.php
    wp_content = generate_wp_config_content(
        db_host=f"{db_config['db_host']}:3306",
        db_name=db_config['db_name'],
        db_user=db_config['db_user'],
        db_password=db_config['db_password']
    )
    write_wp_config(site_dir, wp_content)
    
    # docker-compose.yml (The Logic Under Test)
    compose_config = generate_docker_compose(SITE_NAME, db_config, SITE_PORT)
    compose_path = write_docker_compose(site_dir, compose_config)
    print(f"Docker Compose written to {compose_path}")
    
    # 3. Launch
    print("Launching Containers...")
    success, output = run_docker_compose_up(site_dir)
    if not success:
        print(f"Failed to launch: {output}")
        return False
        
    print("Containers running. Waiting 10s for initialization...")
    time.sleep(10)
    
    # 4. Verify Isolation
    print("\n--- Running Network Tests ---")
    
    # Test 1: DB Isolation (Should FAIL to reach Google)
    print("Test 1: Database Outbound Access (Should Fail)")
    db_container = f"{SITE_NAME}_db"
    # curl --connect-timeout 2 http://8.8.8.8 (Google DNS has no HTTP server, but IP is reachable. Better use google.com)
    # But DB has no DNS access? 'internal: true' blocks external access. 
    # If no DNS, google.com fails instantly.
    # If using IP 8.8.8.8, it times out or 'Network is unreachable'.
    cmd = f"docker exec {db_container} curl --connect-timeout 2 -I http://8.8.8.8"
    result = subprocess.run(cmd, shell=True, capture_output=True)
    if result.returncode != 0:
        print(f"PASS: Database cannot reach internet. (Return Code: {result.returncode})")
    else:
        print("FAIL: Database CAN reach internet!")
        cleanup()
        return False
        
    # Test 2: Web Access (Should SUCCEED to reach Google)
    print("Test 2: Web Server Outbound Access (Should Pass)")
    wp_container = f"{SITE_NAME}_wp"
    cmd = f"docker exec {wp_container} curl --connect-timeout 5 -I -s -o /dev/null -w '%{{http_code}}' http://www.google.com"
    result = subprocess.run(cmd, shell=True, capture_output=True)
    if result.returncode == 0 and result.stdout.decode().strip() in ['200', '301', '302']:
        print(f"PASS: Web Server can reach internet. (HTTP {result.stdout.decode().strip()})")
    else:
        print(f"FAIL: Web Server CANNOT reach internet! (Code: {result.returncode}, Out: {result.stdout}, Err: {result.stderr})")
        # cleanup() 
        return False
        
    # Test 3: Web -> DB Access (Should SUCCEED)
    print("Test 3: Web -> DB Connectivity (Should Pass)")
    # Check if 'db' resolves
    cmd = f"docker exec {wp_container} curl --connect-timeout 2 -v telnet://db:3306" 
    # telnet via curl? curl supports telnet protocol? 
    # curl telnet://host:port works if curl supports it.
    # Or just use mysql client? wp image doesn't have mysql client usually.
    # But it has php. 
    # Or just check resolution.
    # Alternatively, use python one-liner if python3 exists.
    # `docker exec {wp_container} python3 -c "import socket; s=socket.create_connection(('db', 3306), timeout=2)"`
    # WP image has php. `php -r "fsockopen('db', 3306);"`
    
    cmd = f"docker exec {wp_container} php -r \"if(fsockopen('db', 3306)){'{'}echo 'success';{'}'}else{'{'}exit(1);{'}'}\""
    result = subprocess.run(cmd, shell=True, capture_output=True)
    if result.returncode == 0:
        print("PASS: Web Server can reach Database.")
    else:
        print(f"FAIL: Web Server CANNOT reach Database! {result.stderr}")
        return False
        
    print("\n--- All Tests Passed based on Implementation Plan ---")
    cleanup()
    return True

if __name__ == "__main__":
    try:
        verify_vpc()
    except Exception as e:
        print(f"Error: {e}")
        cleanup()
