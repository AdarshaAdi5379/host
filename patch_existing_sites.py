#!/usr/bin/env python3
"""
Patch existing WordPress site docker-compose.yml files to add extra_hosts
so that host.docker.internal resolves correctly on Linux (needed for MinIO access).
"""
import os
import yaml
import glob

SITES_DIR = '/home/adarsha/Desktop/projects/HOST/host/backend/wordpress_sites'
EXTRA_HOSTS = ['host.docker.internal:host-gateway']

def patch_compose_file(compose_path):
    with open(compose_path, 'r') as f:
        config = yaml.safe_load(f)
    
    if not config or 'services' not in config:
        print(f"  Skipping (no services): {compose_path}")
        return False
    
    patched = False
    for service_name, service in config['services'].items():
        if service is None:
            continue
        # Only patch WordPress containers (not db containers)
        if service_name.endswith('_wordpress') or service_name == 'wordpress':
            current_extra_hosts = service.get('extra_hosts', [])
            if 'host.docker.internal:host-gateway' not in current_extra_hosts:
                service['extra_hosts'] = current_extra_hosts + EXTRA_HOSTS
                patched = True
                print(f"  Patched service '{service_name}' in {compose_path}")
    
    if patched:
        with open(compose_path, 'w') as f:
            yaml.dump(config, f, default_flow_style=False, sort_keys=False)
        return True
    else:
        print(f"  Already patched or no WP service: {compose_path}")
        return False

def main():
    compose_files = glob.glob(os.path.join(SITES_DIR, '*/docker-compose.yml'))
    print(f"Found {len(compose_files)} docker-compose.yml files to check.\n")
    
    patched_count = 0
    for compose_path in sorted(compose_files):
        site_name = os.path.basename(os.path.dirname(compose_path))
        print(f"Checking site: {site_name}")
        if patch_compose_file(compose_path):
            patched_count += 1
    
    print(f"\nDone! Patched {patched_count}/{len(compose_files)} files.")
    print("\nNote: Running containers need to be restarted to pick up the new config.")
    print("You can restart a site from the dashboard or run:")
    print("  cd <site_dir> && docker compose down && docker compose up -d")

if __name__ == '__main__':
    main()
