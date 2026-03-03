"""
WordPress Orchestrator - Core logic for provisioning WordPress instances
"""
import os
import socket
import yaml
import zlib
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
    # We need to check 'port', 'api_port', and 'backend_ports'
    assigned_ports = set(WordPressSite.objects.values_list('port', flat=True))
    assigned_api_ports = set(WordPressSite.objects.filter(api_port__isnull=False).values_list('api_port', flat=True))
    
    # Extract backend_ports which is a JSON list
    assigned_backend_ports = set()
    for bp_list in WordPressSite.objects.filter(backend_ports__isnull=False).values_list('backend_ports', flat=True):
        if isinstance(bp_list, list):
            assigned_backend_ports.update(bp_list)

    all_assigned = assigned_ports.union(assigned_api_ports).union(assigned_backend_ports)
    
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
    mysql_server_id = (zlib.crc32(site_name.encode("utf-8")) % 2147483000) + 1000
    mysql_command = " ".join(
        [
            "--default-authentication-plugin=mysql_native_password",
            f"--server-id={mysql_server_id}",
            "--log-bin=mysql-bin",
            "--binlog_format=ROW",
            "--sync-binlog=1",
            "--expire_logs_days=7",
        ]
    )

    db_service = {
        'image': 'mysql:8.0',
        'container_name': f'{site_name}_db',
        'command': mysql_command,
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
            # NOTE: container_name is intentionally OMITTED so that
            # `docker compose up --scale` can create multiple replicas.
            # Docker refuses to scale services with a hardcoded container_name.
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
            'volumes': [
                './frontend_nginx.conf:/etc/nginx/conf.d/default.conf:ro'
            ],
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


def generate_nginx_lb_config(
    site_name: str,
    domain: str,
    frontend_port: int,
    backend_ports: list,
) -> tuple[str, str, str]:
    """
    Generate Nginx config for a react_django site (single or load-balanced).

    Since Nginx runs on the HOST (not inside Docker), upstream entries must
    reference host-mapped ports (``127.0.0.1:{port}``), not container DNS names.

    Args:
        site_name:     Site identifier (used as upstream pool name prefix).
        domain:        Virtual host domain (e.g. mysite.local).
        frontend_port: Host port the React/Nginx frontend container maps to.
        backend_ports: List of host ports mapped to the Django backend replicas.
                       Pass a single-element list for a non-load-balanced setup.

    Returns:
        tuple: (upstream_block, upstream_name, full_nginx_config_string)
               upstream_block is empty string when only one backend port.
    """
    upstream_name = f"{site_name}_cluster"
    replica_count = len(backend_ports)

    if replica_count <= 1:
        # ----------------------------------------------------------------
        # Single backend — simple proxy, no upstream block
        # ----------------------------------------------------------------
        single_port = backend_ports[0] if backend_ports else frontend_port
        upstream_block = ""
        nginx_config = f"""# Orchestrator — {site_name} (single backend)
server {{
    listen 80;
    listen [::]:80;
    server_name {domain};

    # React frontend
    location / {{
        proxy_pass http://127.0.0.1:{frontend_port};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }}

    # Django API
    location /api/ {{
        proxy_pass http://127.0.0.1:{single_port};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }}
}}
"""
    else:
        # ----------------------------------------------------------------
        # Multi-replica — least_conn upstream with host-mapped ports
        # Each port in backend_ports corresponds to one replica container.
        # ----------------------------------------------------------------
        server_lines = "\n".join(
            f"    server 127.0.0.1:{port};  # replica {i + 1}"
            for i, port in enumerate(backend_ports)
        )
        upstream_block = f"""upstream {upstream_name} {{
    least_conn;
{server_lines}
}}"""

        nginx_config = f"""# Orchestrator — {site_name} (load balanced — {replica_count} replicas)
{upstream_block}

server {{
    listen 80;
    listen [::]:80;
    server_name {domain};

    # React frontend (single instance — static files, no LB needed)
    location / {{
        proxy_pass http://127.0.0.1:{frontend_port};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }}

    # Django API — load balanced across {replica_count} replicas
    location /api/ {{
        proxy_pass http://{upstream_name};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
    }}
}}
"""

    return upstream_block, upstream_name, nginx_config


def generate_frontend_nginx_conf(
    site_name: str,
    backend_services: list[str],
) -> str:
    """
    Generate Nginx config for the FRONTEND container to proxy /api/ to backend
    replicas via Docker service DNS (no host Nginx required).
    """
    if not backend_services:
        raise ValueError("backend_services is required")

    if len(backend_services) == 1:
        upstream_block = ""
        upstream_target = f"http://{backend_services[0]}:8000"
    else:
        upstream_name = f"{site_name}_api"
        server_lines = "\n".join(
            f"    server {svc}:8000;  # replica {i + 1}"
            for i, svc in enumerate(backend_services)
        )
        upstream_block = f"""upstream {upstream_name} {{
    least_conn;
{server_lines}
}}"""
        upstream_target = f"http://{upstream_name}"

    config = f"""# Frontend Nginx — {site_name}
{upstream_block}

server {{
    listen 80;
    listen [::]:80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    location /api/ {{
        proxy_pass {upstream_target};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        add_header X-Upstream $upstream_addr always;
        add_header X-Upstream-Status $upstream_status always;
    }}

    location / {{
        try_files $uri /index.html;
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
    Clone a git repository to a destination folder.
    If the specified branch doesn't exist, falls back to cloning the
    remote's default branch (auto-detected).
    """
    import subprocess

    # Ensure destination exists
    if not os.path.exists(destination):
        os.makedirs(destination)

    try:
        # First attempt: clone the specific branch
        cmd = ['git', 'clone', '--branch', branch, '--depth', '1', repo_url, destination]
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return True, f"Repository cloned successfully (branch: {branch})"
    except subprocess.CalledProcessError as e:
        stderr = e.stderr or ''
        # If the branch was not found, retry without --branch to use the default
        if 'not found' in stderr or 'Remote branch' in stderr:
            # Clean up the failed partial clone if any
            import shutil
            if os.path.exists(destination):
                shutil.rmtree(destination)
                os.makedirs(destination)
            try:
                fallback_cmd = ['git', 'clone', '--depth', '1', repo_url, destination]
                subprocess.run(fallback_cmd, capture_output=True, text=True, check=True)
                return True, f"Repository cloned successfully (branch '{branch}' not found — used default branch)"
            except subprocess.CalledProcessError as e2:
                return False, f"Failed to clone repository: {e2.stderr}"
        return False, f"Failed to clone repository: {stderr}"


def detect_and_inject_dockerfiles(site_path):
    """
    Detect the project structure and inject appropriate Dockerfiles.
    Returns a dict with 'frontend_path' and 'backend_path'.

    Each value is either:
      - a string like '.'  or 'frontend'  (dir, Dockerfile auto-detected)
      - a dict  {'context': '.', 'dockerfile': 'Dockerfile.frontend'}
        when both services live in the same directory.
    """
    frontend_path = None
    backend_path = None

    frontend_dockerfile_content = None
    backend_dockerfile_content = None
    frontend_dir_abs = None
    backend_dir_abs = None

    # 1. Search for Frontend (package.json)
    possible_frontend_dirs = ['.', 'frontend', 'client', 'ui', 'web']

    for relative_dir in possible_frontend_dirs:
        check_path = os.path.join(site_path, relative_dir)
        pkg_json_path = os.path.join(check_path, 'package.json')
        if os.path.exists(pkg_json_path):
            frontend_dir_abs = check_path

            # Detect build tool
            build_output_dir = 'build'
            try:
                import json as _json
                with open(pkg_json_path, 'r', encoding='utf-8', errors='ignore') as _pj:
                    _pkg = _json.load(_pj)
                _deps = {**_pkg.get('dependencies', {}), **_pkg.get('devDependencies', {})}
                if 'vite' in _deps or \
                   os.path.exists(os.path.join(check_path, 'vite.config.js')) or \
                   os.path.exists(os.path.join(check_path, 'vite.config.ts')):
                    build_output_dir = 'dist'
            except Exception:
                pass

            # Choose package manager based on lockfile
            yarn_lock = os.path.exists(os.path.join(check_path, 'yarn.lock'))
            pkg_lock = os.path.exists(os.path.join(check_path, 'package-lock.json'))

            if yarn_lock:
                install_lines = (
                    'COPY package.json yarn.lock ./\n'
                    'RUN corepack enable\n'
                    'RUN yarn install --frozen-lockfile\n'
                )
            else:
                install_lines = (
                    'COPY package*.json ./\n'
                    'RUN npm ci --prefer-offline || npm install\n'
                )

            frontend_dockerfile_content = (
                '# Stage 1: Build the React app\n'
                'FROM node:18-alpine AS builder\n'
                'WORKDIR /app\n'
                + install_lines +
                'COPY . .\n'
                + (
                    'RUN yarn build\n' if yarn_lock else
                    # CRA (webpack 4) needs legacy OpenSSL on Node 17+
                    'ENV NODE_OPTIONS=--openssl-legacy-provider\n'
                    'RUN npm run build\n'
                ) +
                '\n'
                '# Stage 2: Serve with Nginx\n'
                'FROM nginx:alpine\n'
                'COPY --from=builder /app/' + build_output_dir + ' /usr/share/nginx/html\n'
                'EXPOSE 80\n'
                'CMD ["nginx", "-g", "daemon off;"]\n'
            )
            frontend_path = relative_dir
            break

    # 2. Search for Backend (manage.py for Django)
    possible_backend_dirs = ['.', 'backend', 'server', 'api']

    for relative_dir in possible_backend_dirs:
        if relative_dir == frontend_path and relative_dir != '.':
            continue

        check_path = os.path.join(site_path, relative_dir)
        manage_py_path = os.path.join(check_path, 'manage.py')
        if os.path.exists(manage_py_path):
            backend_dir_abs = check_path

            # FIX 4: Auto-detect Django project name — more robust detection
            wsgi_module = None
            django_project_name = None
            try:
                import re as _re
                with open(manage_py_path, 'r', encoding='utf-8', errors='ignore') as mpy:
                    for _line in mpy:
                        if 'DJANGO_SETTINGS_MODULE' in _line and '.' in _line:
                            _pat = r"""['\"]([\w]+)\.settings['\"]"""
                            _m = _re.search(_pat, _line)
                            if _m:
                                django_project_name = _m.group(1)
                                wsgi_module = django_project_name + '.wsgi:application'
                                break
            except Exception:
                pass

            # Fallback: scan for wsgi.py in the backend directory tree
            if not wsgi_module:
                for root, dirs, files in os.walk(check_path):
                    if 'wsgi.py' in files:
                        # Derive module path relative to backend dir
                        rel = os.path.relpath(root, check_path)
                        if rel == '.':
                            wsgi_module = 'wsgi:application'
                            django_project_name = None
                        else:
                            pkg = rel.replace(os.sep, '.')
                            wsgi_module = pkg + '.wsgi:application'
                            django_project_name = rel.split(os.sep)[0]
                        break

            # Final fallback
            if not wsgi_module:
                wsgi_module = 'core.wsgi:application'
                django_project_name = 'core'

            # FIX 3: Find requirements.txt relative to the build context
            req_path = os.path.join(check_path, 'requirements.txt')
            req_copy_line = ''
            if os.path.exists(req_path):
                _sanitize_requirements(req_path)
                req_copy_line = (
                    'COPY requirements.txt .\n'
                    'RUN pip install --upgrade pip && pip install -r requirements.txt\n'
                    'RUN pip install gunicorn\n'
                )
            else:
                # requirements.txt may not exist — install gunicorn only
                req_copy_line = (
                    'RUN pip install --upgrade pip gunicorn\n'
                )

            # FIX 2: Set DJANGO_SETTINGS_MODULE env var
            settings_env_line = ''
            if django_project_name:
                settings_env_line = f'ENV DJANGO_SETTINGS_MODULE={django_project_name}.settings\n'

            # FIX 5: Add gunicorn timeout and multiple workers
            gunicorn_cmd = (
                'CMD ["gunicorn", "' + wsgi_module + '", '
                '"--bind", "0.0.0.0:8000", '
                '"--workers", "2", '
                '"--timeout", "120"]\n'
            )

            backend_dockerfile_content = (
                'FROM python:3.10\n'
                'WORKDIR /app\n'
                + settings_env_line
                + req_copy_line
                + 'COPY . .\n'
                'EXPOSE 8000\n'
                + gunicorn_cmd
            )
            backend_path = relative_dir
            break

    # 3. Write Dockerfiles
    # If both services share the SAME directory, write named Dockerfiles so
    # docker-compose can distinguish them via the `dockerfile:` key.
    if frontend_dir_abs and backend_dir_abs and frontend_dir_abs == backend_dir_abs:
        # Monorepo / single-dir case
        fe_dockerfile_name = 'Dockerfile.frontend'
        be_dockerfile_name = 'Dockerfile.backend'

        with open(os.path.join(frontend_dir_abs, fe_dockerfile_name), 'w') as f:
            f.write(frontend_dockerfile_content.strip())
        with open(os.path.join(backend_dir_abs, be_dockerfile_name), 'w') as f:
            f.write(backend_dockerfile_content.strip())

        # Return build dicts instead of plain strings so the compose generator
        # can use `{'context': '.', 'dockerfile': 'Dockerfile.frontend'}`
        frontend_path = {'context': frontend_path, 'dockerfile': fe_dockerfile_name}
        backend_path = {'context': backend_path, 'dockerfile': be_dockerfile_name}
    else:
        # Separate directories — write standard Dockerfiles
        if frontend_dir_abs and frontend_dockerfile_content:
            with open(os.path.join(frontend_dir_abs, 'Dockerfile'), 'w') as f:
                f.write(frontend_dockerfile_content.strip())
        if backend_dir_abs and backend_dockerfile_content:
            with open(os.path.join(backend_dir_abs, 'Dockerfile'), 'w') as f:
                f.write(backend_dockerfile_content.strip())

    return {
        'frontend_path': frontend_path,
        'backend_path': backend_path,
    }


def _sanitize_requirements(req_path: str):
    """
    Sanitize a requirements.txt to fix common issues:
    - Non-existent Django versions (e.g. Django==6.x.x) → latest stable
    - Non-existent DRF versions
    Reads the file, fixes invalid pins, and writes it back.
    """
    import re
    DJANGO_LATEST = '5.2'          # Highest stable at time of writing
    DRF_LATEST = '3.15.2'
    
    lines = []
    try:
        raw = Path(req_path).read_bytes()
        if b'\x00' in raw:
            # Likely UTF-16 encoded requirements.txt
            text = raw.decode('utf-16', errors='ignore')
        else:
            text = raw.decode('utf-8', errors='ignore')
        lines = text.splitlines(keepends=True)
    except Exception:
        return
    
    fixed_lines = []
    changed = False
    for line in lines:
        stripped = line.strip()
        # Drop backports.zoneinfo on Python 3.9+ (not needed, often fails to build)
        if re.match(r'^backports\.zoneinfo==', stripped, re.IGNORECASE):
            changed = True
            continue
        # Fix invalid Django versions (>= 6.x which doesn't exist)
        m = re.match(r'^(Django)==(\d+)\.(\d+)', stripped, re.IGNORECASE)
        if m:
            major = int(m.group(2))
            if major >= 6:
                new_line = f'Django=={DJANGO_LATEST}\n'
                fixed_lines.append(new_line)
                changed = True
                continue
        # Fix invalid djangorestframework versions (> 3.15.x)
        m = re.match(r'^(djangorestframework)==(\d+)\.(\d+)', stripped, re.IGNORECASE)
        if m:
            major, minor = int(m.group(2)), int(m.group(3))
            if major > 3 or (major == 3 and minor > 15):
                new_line = f'djangorestframework=={DRF_LATEST}\n'
                fixed_lines.append(new_line)
                changed = True
                continue
        fixed_lines.append(line)
    
    if changed or b'\x00' in locals().get('raw', b''):
        with open(req_path, 'w', encoding='utf-8') as f:
            f.writelines(fixed_lines)
