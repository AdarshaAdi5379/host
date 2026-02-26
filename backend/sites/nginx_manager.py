"""
Nginx Configuration Manager for WordPress Orchestrator
Manages Nginx reverse proxy configurations — Linux implementation.
"""
import os
import subprocess
from pathlib import Path


# ---------------------------------------------------------------------------
# Path Discovery
# ---------------------------------------------------------------------------

def get_nginx_executable() -> str | None:
    """
    Locate the nginx binary on Linux.

    Returns:
        str: Absolute path to the nginx executable, or None if not found.
    """
    known_paths = [
        "/usr/sbin/nginx",
        "/usr/bin/nginx",
        "/usr/local/sbin/nginx",
        "/usr/local/bin/nginx",
    ]
    for path in known_paths:
        if os.path.isfile(path) and os.access(path, os.X_OK):
            return path

    # Fall back to PATH lookup
    try:
        result = subprocess.run(
            ["which", "nginx"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        if result.returncode == 0:
            return result.stdout.strip()
    except Exception:
        pass

    return None


def get_nginx_conf_dir() -> Path | None:
    """
    Return the Nginx sites-enabled directory, creating it if necessary.

    Returns:
        Path | None: sites-enabled directory, or None if base conf dir missing.
    """
    base_dirs = [
        Path("/etc/nginx"),
        Path("/usr/local/etc/nginx"),
    ]
    for base in base_dirs:
        if base.exists():
            sites_dir = base / "sites-enabled"
            sites_dir.mkdir(parents=True, exist_ok=True)
            return sites_dir

    return None


# ---------------------------------------------------------------------------
# Config Writing / Reading
# ---------------------------------------------------------------------------

def write_site_config(site_name: str, domain: str, port: int) -> tuple[bool, str, str | None]:
    """
    Write a simple (single-backend) Nginx server block for a site.

    Args:
        site_name: Unique site identifier.
        domain:    Virtual host name (e.g., ``mysite.local``).
        port:      Host port the container is listening on.

    Returns:
        tuple: (success, message, config_path_or_None)
    """
    sites_dir = get_nginx_conf_dir()
    if not sites_dir:
        return False, "Nginx conf directory not found (/etc/nginx/sites-enabled)", None

    config_content = f"""# WordPress Orchestrator — {site_name}
server {{
    listen 80;
    listen [::]:80;
    server_name {domain};

    location / {{
        proxy_pass http://127.0.0.1:{port};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }}
}}
"""
    config_path = sites_dir / f"{site_name}.conf"
    try:
        config_path.write_text(config_content)
        return True, f"Nginx config written: {config_path}", str(config_path)
    except PermissionError:
        return False, f"Permission denied writing {config_path}. Run Django with sudo or fix /etc/nginx ownership.", None
    except Exception as exc:
        return False, f"Failed to write Nginx config: {exc}", None


def write_lb_site_config(
    site_name: str,
    domain: str,
    upstream_block: str,
    upstream_name: str,
) -> tuple[bool, str, str | None]:
    """
    Write a load-balanced Nginx server block (uses an upstream pool).

    Args:
        site_name:      Unique site identifier.
        domain:         Virtual host name.
        upstream_block: Full ``upstream { ... }`` block text.
        upstream_name:  Name of the upstream pool to proxy to.

    Returns:
        tuple: (success, message, config_path_or_None)
    """
    sites_dir = get_nginx_conf_dir()
    if not sites_dir:
        return False, "Nginx conf directory not found", None

    config_content = f"""# WordPress Orchestrator — {site_name} (Load Balanced)
{upstream_block}

server {{
    listen 80;
    listen [::]:80;
    server_name {domain};

    location / {{
        proxy_pass http://{upstream_name};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }}
}}
"""
    config_path = sites_dir / f"{site_name}.conf"
    try:
        config_path.write_text(config_content)
        return True, f"LB Nginx config written: {config_path}", str(config_path)
    except PermissionError:
        return False, f"Permission denied writing {config_path}. Run Django with sudo or fix /etc/nginx ownership.", None
    except Exception as exc:
        return False, f"Failed to write LB Nginx config: {exc}", None


def remove_site_config(site_name: str) -> tuple[bool, str]:
    """Remove the Nginx config file for a site."""
    sites_dir = get_nginx_conf_dir()
    if not sites_dir:
        return False, "Nginx conf directory not found"

    config_path = sites_dir / f"{site_name}.conf"
    try:
        if config_path.exists():
            config_path.unlink()
            return True, f"Nginx config removed: {config_path}"
        return True, "Config file not found (already removed)"
    except Exception as exc:
        return False, f"Failed to remove Nginx config: {exc}"


# ---------------------------------------------------------------------------
# Nginx Process Control
# ---------------------------------------------------------------------------

def test_nginx_config() -> tuple[bool, str]:
    """Run ``nginx -t`` to validate configuration syntax."""
    nginx = get_nginx_executable()
    if not nginx:
        return False, "nginx binary not found on this system"
    try:
        result = subprocess.run(
            [nginx, "-t"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        output = result.stdout + result.stderr
        return result.returncode == 0, output
    except Exception as exc:
        return False, f"Failed to test nginx config: {exc}"


def reload_nginx() -> tuple[bool, str]:
    """
    Gracefully reload Nginx using ``nginx -s reload``.
    Tests config first — never reloads with a broken config.
    """
    nginx = get_nginx_executable()
    if not nginx:
        return False, "nginx binary not found. Install nginx: sudo apt install nginx"

    ok, test_out = test_nginx_config()
    if not ok:
        return False, f"Nginx config test failed — NOT reloading:\n{test_out}"

    try:
        result = subprocess.run(
            [nginx, "-s", "reload"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        if result.returncode == 0:
            return True, "Nginx reloaded successfully (graceful — no dropped connections)"
        # May fail if nginx isn't yet running — try starting it
        return start_nginx()
    except Exception as exc:
        return False, f"Failed to reload Nginx: {exc}"


def start_nginx() -> tuple[bool, str]:
    """Start the Nginx service."""
    nginx = get_nginx_executable()
    if not nginx:
        return False, "nginx binary not found"
    try:
        result = subprocess.run(
            [nginx],
            capture_output=True,
            text=True,
            timeout=10,
        )
        if result.returncode == 0:
            return True, "Nginx started successfully"
        return False, result.stderr or "Nginx failed to start"
    except Exception as exc:
        return False, f"Failed to start Nginx: {exc}"


def stop_nginx() -> tuple[bool, str]:
    """Stop the Nginx service gracefully."""
    nginx = get_nginx_executable()
    if not nginx:
        return False, "nginx binary not found"
    try:
        result = subprocess.run(
            [nginx, "-s", "quit"],  # graceful shutdown (vs "stop" = immediate)
            capture_output=True,
            text=True,
            timeout=10,
        )
        return True, "Nginx stopped"
    except Exception as exc:
        return False, f"Failed to stop Nginx: {exc}"


def is_nginx_running() -> bool:
    """Return True if an nginx process is currently running."""
    try:
        result = subprocess.run(
            ["pgrep", "nginx"],
            capture_output=True,
            timeout=5,
        )
        return result.returncode == 0
    except Exception:
        return False


# ---------------------------------------------------------------------------
# Main Config Bootstrap
# ---------------------------------------------------------------------------

def ensure_nginx_main_config() -> tuple[bool, str]:
    """
    Write the top-level nginx.conf that includes sites-enabled/*.conf.
    Backs up the original before overwriting.
    """
    base_dirs = [Path("/etc/nginx"), Path("/usr/local/etc/nginx")]
    nginx_path = next((p for p in base_dirs if p.exists()), None)

    if not nginx_path:
        return False, "Could not find Nginx base directory (/etc/nginx)"

    main_conf = nginx_path / "nginx.conf"
    backup_conf = nginx_path / "nginx.conf.original"

    config_content = """\
worker_processes auto;

events {
    worker_connections 1024;
    multi_accept on;
}

http {
    include       mime.types;
    default_type  application/octet-stream;
    sendfile        on;
    tcp_nopush      on;
    tcp_nodelay     on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    # Logging
    access_log /var/log/nginx/access.log;
    error_log  /var/log/nginx/error.log;

    # Default server — catches unmatched requests
    server {
        listen 80 default_server;
        listen [::]:80 default_server;
        server_name _;

        location / {
            add_header Content-Type text/plain;
            return 200 "Nginx is working. If you see this, the domain is not configured.";
        }
    }

    # WordPress Orchestrator sites
    include sites-enabled/*.conf;
}
"""
    try:
        # Back up original only once
        if main_conf.exists() and not backup_conf.exists():
            import shutil
            shutil.copy2(main_conf, backup_conf)

        main_conf.write_text(config_content)
        return True, "nginx.conf updated to managed configuration"
    except PermissionError:
        return False, "Permission denied writing nginx.conf — run with sudo or fix ownership"
    except Exception as exc:
        return False, f"Failed to update nginx.conf: {exc}"
