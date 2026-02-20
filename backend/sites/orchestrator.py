"""
WordPress Orchestrator - Core logic for provisioning WordPress instances
"""
import os
import socket
import yaml
from pathlib import Path
from django.conf import settings


def find_available_port(start_port=9000, end_port=9999, count=1):
    """
    Find available port(s) in the specified range
    Checks both network availability and database assignments
    
    Args:
        count: Number of consecutive ports needed (default 1)
    
    Returns:
        int or list: Single port if count=1, else list of ports
    """
    # Import here to avoid circular dependency
    from .models import WordPressSite
    
    # Get all ports already assigned in database
    # We need to check both 'port' and 'api_port'
    assigned_ports = set(WordPressSite.objects.values_list('port', flat=True))
    assigned_api_ports = set(WordPressSite.objects.filter(api_port__isnull=False).values_list('api_port', flat=True))
    all_assigned = assigned_ports.union(assigned_api_ports)
    
    found_ports = []
    
    for port in range(start_port, end_port + 1):
        # Check if this port is free
        if port in all_assigned:
            found_ports = [] # Reset consecutive count if we hit a snag
            continue
            
        # Check network availability
        is_free = False
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            try:
                sock.bind(('127.0.0.1', port))
                is_free = True
            except OSError:
                is_free = False
        
        if is_free:
            found_ports.append(port)
            if len(found_ports) == count:
                if count == 1:
                    return found_ports[0]
                return found_ports
        else:
            found_ports = [] # Reset on network conflict
            
    raise RuntimeError(f"No available ports in range {start_port}-{end_port}")


def generate_docker_compose(site_name, db_config, port, site_type='wordpress', api_port=None, repo_paths=None, env_vars=None):
    """
    Generate docker-compose.yml configuration
    
    Args:
        site_name: Name of the site
        db_config: Database configuration dict
        port: Host port to map to Frontend/WordPress
        site_type: 'wordpress' or 'react_django'
        api_port: Host port to map to Backend API (Full Stack only)
        repo_paths: Dict with 'frontend_path' and 'backend_path' (Full Stack only)
        env_vars: Dict of environment variables to inject
    """
    db_host = db_config.get('db_host')
    db_password = db_config.get('db_password')
    db_user = db_config.get('db_user', 'wordpress')
    db_name = db_config.get('db_name', 'wordpress')
    
    # Common Network Config
    networks_config = {
        'vpc_public_web': {
            'driver': 'bridge'
        },
        'vpc_private_db': {
            'driver': 'bridge',
            'internal': True  # The "Zero Trust" Lock
        },
        'tenant_isolated': {
            'external': True  # For Adminer
        }
    }
    
    # ----------------------------------------------------------------
    # 1. DATABASE SERVICE (Common for VPC)
    # ----------------------------------------------------------------
    db_service = {
        'image': 'mysql:8.0',
        'container_name': f'{site_name}_db',
        'command': '--default-authentication-plugin=mysql_native_password',
        'restart': 'unless-stopped',
        'environment': {
            'MYSQL_ROOT_PASSWORD': db_config.get('root_password'),
            'MYSQL_DATABASE': db_name,
            'MYSQL_USER': db_user,
            'MYSQL_PASSWORD': db_password,
        },
        'volumes': ['db_data:/var/lib/mysql'],
        'networks': ['tenant_isolated', 'vpc_private_db'],
        'ports': ['127.0.0.1:0:3306']
    }

    services = {'db': db_service}
    
    # ----------------------------------------------------------------
    # 2. REACT + DJANGO ARCHITECTURE
    # ----------------------------------------------------------------
    if site_type == 'react_django':
        if not api_port or not repo_paths:
            raise ValueError("API Port and Repo Paths required for React+Django")
            
        frontend_build = repo_paths.get('frontend_path', '.')
        backend_build = repo_paths.get('backend_path', '.')
        
        # Backend Service (Django)
        backend_env = {
            'DATABASE_URL': f'mysql://{db_user}:{db_password}@db/{db_name}',
            'AllowedHosts': '*'
        }
        
        # Inject user env vars into backend
        if env_vars:
            backend_env.update(env_vars)
            
        services[f'{site_name}_backend'] = {
            'build': backend_build,
            'container_name': f'{site_name}_backend',
            'restart': 'unless-stopped',
            'ports': [f'{api_port}:8000'],
            'environment': backend_env,
            'networks': ['vpc_public_web', 'vpc_private_db'],
            'depends_on': ['db']
        }
        
        # Frontend Service (React/Nginx)
        services[f'{site_name}_frontend'] = {
            'build': frontend_build,
            'container_name': f'{site_name}_frontend',
            'restart': 'unless-stopped',
            'ports': [f'{port}:80'],
            'networks': ['vpc_public_web'],
            'depends_on': [f'{site_name}_backend']
        }

    # ----------------------------------------------------------------
    # 3. WORDPRESS ARCHITECTURE (Default)
    # ----------------------------------------------------------------
    else:
        services[f'{site_name}_wordpress'] = {
            'image': 'hostinger_wordpress:latest',
            'container_name': f'{site_name}_wp',
            'restart': 'unless-stopped',
            'ports': [f'{port}:80'],
            'environment': {
                'WORDPRESS_DB_HOST': 'db:3306',
                'WORDPRESS_DB_USER': db_user,
                'WORDPRESS_DB_PASSWORD': db_password,
                'WORDPRESS_DB_NAME': db_name,
            },
            'volumes': [
                './html:/var/www/html',
                './wp-config.php:/var/www/html/wp-config.php'
            ],
            'networks': ['vpc_public_web', 'vpc_private_db'],
            'extra_hosts': ['host.docker.internal:host-gateway'],
            'depends_on': ['db']
        }
    
    return {
        'version': '3.8',
        'services': services,
        'networks': networks_config,
        'volumes': {'db_data': {}}
    }

    # ----------------------------------------------------------------
    # LEGACY ARCHITECTURE (Existing Sites)
    # External Database Container
    # ----------------------------------------------------------------
    
    compose_config = {
        'version': '3.8',
        'services': {
            f'{site_name}_wordpress': {
                'image': 'hostinger_wordpress:latest',
                'container_name': f'{site_name}_wp',
                'restart': 'unless-stopped',
                'ports': [
                    f'{port}:80'
                ],
                'environment': {
                    'WORDPRESS_DB_HOST': f'{db_host}:3306',
                    'WORDPRESS_DB_USER': db_user,
                    'WORDPRESS_DB_PASSWORD': db_password,
                    'WORDPRESS_DB_NAME': db_name,
                },
                'volumes': [
                    './html:/var/www/html',
                    './wp-config.php:/var/www/html/wp-config.php'
                ],
                'networks': [
                    network_name
                ],
                'extra_hosts': [
                    'host.docker.internal:host-gateway'  # Linux host resolution for MinIO
                ]
            }
        },
        'networks': {
            network_name: {
                'driver': 'bridge'
            }
        }
    }
    
    return compose_config


def generate_wp_config_content(db_host, db_name, db_user, db_password):
    """
    Generate the content for wp-config.php
    """
    import secrets
    
    def generate_salt():
        return ''.join(secrets.choice('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=[]{}<>') for _ in range(64))

    return f"""<?php
/**
 * The base configuration for WordPress
 *
 * This file was auto-generated by the Host Orchestrator.
 */

// ** Database settings ** //
define( 'DB_NAME', '{db_name}' );
define( 'DB_USER', '{db_user}' );
define( 'DB_PASSWORD', '{db_password}' );
define( 'DB_HOST', '{db_host}' );
define( 'DB_CHARSET', 'utf8mb4' );
define( 'DB_COLLATE', '' );

/**#@+
 * Authentication unique keys and salts.
 */
define( 'AUTH_KEY',         '{generate_salt()}' );
define( 'SECURE_AUTH_KEY',  '{generate_salt()}' );
define( 'LOGGED_IN_KEY',    '{generate_salt()}' );
define( 'NONCE_KEY',        '{generate_salt()}' );
define( 'AUTH_SALT',        '{generate_salt()}' );
define( 'SECURE_AUTH_SALT', '{generate_salt()}' );
define( 'LOGGED_IN_SALT',   '{generate_salt()}' );
define( 'NONCE_SALT',       '{generate_salt()}' );

/**#@-*/

/**
 * WordPress database table prefix.
 */
$table_prefix = 'wp_';

/**
 * For developers: WordPress debugging mode.
 */
define( 'WP_DEBUG', false );

// Fix for "Plain" Admin/Dashboard in Docker
define('CONCATENATE_SCRIPTS', false);
define('SCRIPT_DEBUG', true);

// ** Dynamic Site URL Settings ** //
// This allows the site to be accessed via localhost:PORT or custom domains
$protocol = 'http';

// Detect HTTPS from various sources (Cloudflare Tunnel, reverse proxy, etc.)
if (
    (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ||
    (!empty($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https') ||
    (!empty($_SERVER['HTTP_X_FORWARDED_SSL']) && $_SERVER['HTTP_X_FORWARDED_SSL'] === 'on') ||
    (!empty($_SERVER['SERVER_PORT']) && $_SERVER['SERVER_PORT'] == 443)
) {{
    $protocol = 'https';
    $_SERVER['HTTPS'] = 'on';
}}

if (isset($_SERVER['HTTP_HOST'])) {{
    define('WP_HOME', $protocol . '://' . $_SERVER['HTTP_HOST']);
    define('WP_SITEURL', $protocol . '://' . $_SERVER['HTTP_HOST']);
}}

/** Absolute path to the WordPress directory. */
if ( ! defined( 'ABSPATH' ) ) {{
    define( 'ABSPATH', __DIR__ . '/' );
}}

/** Sets up WordPress vars and included files. */
require_once ABSPATH . 'wp-settings.php';
"""


def write_wp_config(site_directory, content):
    """Write wp-config.php to the site directory"""
    config_path = Path(site_directory) / 'wp-config.php'
    
    with open(config_path, 'w') as f:
        f.write(content)
    
    return str(config_path)


def write_docker_compose(site_directory, compose_config):
    """Write docker-compose.yml to the site directory"""
    compose_path = Path(site_directory) / 'docker-compose.yml'
    
    # Custom YAML representer to quote all strings (prevents interpolation issues)
    class QuotedDumper(yaml.SafeDumper):
        pass
    
    def quoted_presenter(dumper, data):
        """Force all strings to be quoted in YAML"""
        return dumper.represent_scalar('tag:yaml.org,2002:str', data, style='"')
    
    QuotedDumper.add_representer(str, quoted_presenter)
    
    with open(compose_path, 'w') as f:
        yaml.dump(compose_config, f, Dumper=QuotedDumper, default_flow_style=False, sort_keys=False)
    
    return str(compose_path)


def generate_nginx_config(site_name, domain, port):
    """
    Generate Nginx server block configuration
    
    Args:
        site_name: Name of the site
        domain: Local domain (e.g., mysite.local)
        port: Port where WordPress is running
    
    Returns:
        str: Nginx configuration content
    """
    config = f"""server {{
    listen 80;
    server_name {domain};

    location / {{
        proxy_pass http://127.0.0.1:{port};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }}
}}
"""
    return config


def create_site_directory(site_name):
    """Create directory structure for a WordPress site"""
    sites_dir = settings.WORDPRESS_SITES_DIR
    site_dir = sites_dir / site_name
    
    # Create directories
    os.makedirs(site_dir, exist_ok=True)
    os.makedirs(sites_dir, exist_ok=True)
    
    return str(site_dir)


def clone_repository(repo_url, branch, destination):
    """
    Clone a git repository to a destination folder
    """
    import subprocess
    
    # Ensure destination exists
    if not os.path.exists(destination):
        os.makedirs(destination)
        
    try:
        # Securely clone using subprocess
        # Note: In production, handle SSH keys or Auth Tokens for private repos
        cmd = ['git', 'clone', '--branch', branch, '--depth', '1', repo_url, destination]
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return True, "Repository cloned successfully"
    except subprocess.CalledProcessError as e:
        return False, f"Failed to clone repository: {e.stderr}"


def detect_and_inject_dockerfiles(site_path):
    """
    Detect the project structure and inject appropriate Dockerfiles
    Returns a dict with 'frontend_path' and 'backend_path' relative to site_path
    """
    frontend_path = None
    backend_path = None
    
    # 1. Search for Frontend (package.json)
    # Strategy: Look in root, then in 'frontend', 'client', 'ui' folders
    possible_frontend_dirs = ['.', 'frontend', 'client', 'ui', 'web']
    
    for relative_dir in possible_frontend_dirs:
        check_path = os.path.join(site_path, relative_dir)
        if os.path.exists(os.path.join(check_path, 'package.json')):
            frontend_path = relative_dir
            # Inject React Dockerfile
            dockerfile_content = """
# Stage 1: Build the React app
FROM node:18-alpine AS builder
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine
COPY --from=builder /app/build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
"""
            with open(os.path.join(check_path, 'Dockerfile'), 'w') as f:
                f.write(dockerfile_content.strip())
            break
            
    # 2. Search for Backend (manage.py for Django)
    # Strategy: Look in root, then 'backend', 'server', 'api' folders
    possible_backend_dirs = ['.', 'backend', 'server', 'api']
    
    for relative_dir in possible_backend_dirs:
        # Don't confuse frontend with backend if they are in same dir (unlikely but possible)
        if relative_dir == frontend_path and relative_dir != '.':
            continue
            
        check_path = os.path.join(site_path, relative_dir)
        if os.path.exists(os.path.join(check_path, 'manage.py')):
            backend_path = relative_dir
            # Inject Django Dockerfile
            dockerfile_content = """
FROM python:3.10
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
RUN pip install gunicorn
COPY . .
EXPOSE 8000
# Run the app using Gunicorn
CMD ["gunicorn", "core.wsgi:application", "--bind", "0.0.0.0:8000"]
"""
            # Note: We assume 'core.wsgi' exists. Real implementation might need to parse manage.py to find project name.
            # Only simplistic injection for now.
            
            with open(os.path.join(check_path, 'Dockerfile'), 'w') as f:
                f.write(dockerfile_content.strip())
            break
            
    return {
        'frontend_path': frontend_path,
        'backend_path': backend_path
    }
