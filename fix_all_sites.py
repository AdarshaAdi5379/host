
import os
import subprocess
from pathlib import Path

SITES_DIR = Path("backend/wordpress_sites")

def fix_site(site_name):
    site_dir = SITES_DIR / site_name
    config_path = site_dir / "wp-config.php"
    
    if not config_path.exists():
        print(f"Skipping {site_name}: No wp-config.php found.")
        return

    print(f"fixing {site_name}...")
    
    # Read config
    with open(config_path, 'r') as f:
        content = f.read()
        
    # Check if already fixed
    if "CONCATENATE_SCRIPTS" in content:
        print(f"Skipping {site_name}: Already fixed.")
    else:
        # Inject fix
        fix_code = "\n// Fix for \"Plain\" Admin/Dashboard in Docker\ndefine('CONCATENATE_SCRIPTS', false);\ndefine('SCRIPT_DEBUG', true);\n"
        
        # Insert after WP_DEBUG
        if "define( 'WP_DEBUG', false );" in content:
            new_content = content.replace("define( 'WP_DEBUG', false );", "define( 'WP_DEBUG', false );" + fix_code)
        else:
            # Fallback: insert before "Dynamic Site URL" or end
            new_content = fix_code + content
            
        with open(config_path, 'w') as f:
            f.write(new_content)
        print(f"Updated wp-config.php for {site_name}")

    # Copy to container and restart
    container_name = f"{site_name}_wp"
    print(f"Applying to container {container_name}...")
    
    # Docker CP
    try:
        if os.name == 'nt':
            # Windows path handling for docker cp can be tricky, use absolute string
            src_abs = str(config_path.absolute())
            cmd = ['docker', 'cp', src_abs, f'{container_name}:/var/www/html/wp-config.php']
        else:
            cmd = ['docker', 'cp', str(config_path), f'{container_name}:/var/www/html/wp-config.php']
            
        subprocess.run(cmd, check=True, capture_output=True)
        
        # Docker Restart
        subprocess.run(['docker', 'restart', container_name], check=True, capture_output=True)
        print(f"SUCCESS: {site_name} restarted.")
        
    except subprocess.CalledProcessError as e:
        print(f"ERROR: Failed to update container for {site_name}. Is it running?")
        # print(e.stderr)

def main():
    if not SITES_DIR.exists():
        print("Sites directory not found.")
        return

    for item in SITES_DIR.iterdir():
        if item.is_dir():
             fix_site(item.name)

if __name__ == "__main__":
    main()
