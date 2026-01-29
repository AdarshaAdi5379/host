"""
Nginx Configuration Manager for WordPress Orchestrator
Manages Nginx reverse proxy configurations for .local domains
"""
import os
import subprocess
from pathlib import Path


def get_nginx_path():
    """
    Find Nginx installation directory
    
    Returns:
        Path or None: Nginx installation path
    """
    # Common Nginx installation paths on Windows
    possible_paths = [
        Path("C:/nginx"),
        Path("C:/Program Files/nginx"),
        Path("C:/tools/nginx"),
        Path(os.environ.get("ProgramData", "C:/ProgramData")) / "chocolatey/lib/nginx/tools",
    ]
    
    for path in possible_paths:
        if path.exists() and (path / "nginx.exe").exists():
            return path
    
    # Try to find via PATH
    try:
        result = subprocess.run(
            ["where", "nginx"],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0:
            nginx_exe = Path(result.stdout.strip().split('\n')[0])
            return nginx_exe.parent
    except:
        pass
    
    return None


def get_nginx_conf_dir():
    """Get Nginx configuration directory"""
    nginx_path = get_nginx_path()
    if not nginx_path:
        return None
    
    conf_dir = nginx_path / "conf"
    if not conf_dir.exists():
        return None
    
    # Create sites directory if it doesn't exist
    sites_dir = conf_dir / "sites"
    sites_dir.mkdir(exist_ok=True)
    
    return sites_dir


def write_site_config(site_name, domain, port):
    """
    Generate and write Nginx configuration for a WordPress site
    
    Args:
        site_name: Name of the site (e.g., 'mysite')
        domain: Domain name (e.g., 'mysite.local')
        port: Port where WordPress is running (e.g., 9001)
    
    Returns:
        tuple: (success: bool, message: str, config_path: str)
    """
    sites_dir = get_nginx_conf_dir()
    if not sites_dir:
        return False, "Nginx not found or conf directory missing", None
    
    config_content = f"""# WordPress Orchestrator - {site_name}
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
        
        # WebSocket support (for WordPress admin)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }}
}}
"""
    
    config_path = sites_dir / f"{site_name}.conf"
    
    try:
        with open(config_path, 'w') as f:
            f.write(config_content)
        return True, f"Nginx config created: {config_path}", str(config_path)
    except Exception as e:
        return False, f"Failed to write Nginx config: {str(e)}", None


def remove_site_config(site_name):
    """
    Remove Nginx configuration for a site
    
    Args:
        site_name: Name of the site
    
    Returns:
        tuple: (success: bool, message: str)
    """
    sites_dir = get_nginx_conf_dir()
    if not sites_dir:
        return False, "Nginx not found or conf directory missing"
    
    config_path = sites_dir / f"{site_name}.conf"
    
    try:
        if config_path.exists():
            config_path.unlink()
            return True, f"Nginx config removed: {config_path}"
        else:
            return True, "Config file not found (already removed)"
    except Exception as e:
        return False, f"Failed to remove Nginx config: {str(e)}"


def test_nginx_config():
    """
    Test Nginx configuration for syntax errors
    
    Returns:
        tuple: (success: bool, output: str)
    """
    nginx_path = get_nginx_path()
    if not nginx_path:
        return False, "Nginx not found"
    
    nginx_exe = nginx_path / "nginx.exe"
    
    try:
        result = subprocess.run(
            [str(nginx_exe), "-t"],
            capture_output=True,
            text=True,
            timeout=10,
            cwd=str(nginx_path)
        )
        
        output = result.stdout + result.stderr
        return result.returncode == 0, output
    except Exception as e:
        return False, f"Failed to test config: {str(e)}"


def reload_nginx():
    """
    Reload Nginx to apply configuration changes
    
    Returns:
        tuple: (success: bool, message: str)
    """
    nginx_path = get_nginx_path()
    if not nginx_path:
        return False, "Nginx not found. Please install Nginx first."
    
    nginx_exe = nginx_path / "nginx.exe"
    
    # First, test the configuration
    test_success, test_output = test_nginx_config()
    if not test_success:
        return False, f"Nginx config test failed:\n{test_output}"
    
    try:
        # Reload Nginx
        result = subprocess.run(
            [str(nginx_exe), "-s", "reload"],
            capture_output=True,
            text=True,
            timeout=10,
            cwd=str(nginx_path)
        )
        
        if result.returncode == 0:
            return True, "Nginx reloaded successfully"
        else:
            # If reload fails, Nginx might not be running - try to start it
            return start_nginx()
    except Exception as e:
        return False, f"Failed to reload Nginx: {str(e)}"


def start_nginx():
    """
    Start Nginx server
    
    Returns:
        tuple: (success: bool, message: str)
    """
    nginx_path = get_nginx_path()
    if not nginx_path:
        return False, "Nginx not found. Please install Nginx first."
    
    nginx_exe = nginx_path / "nginx.exe"
    
    try:
        # Start Nginx in background
        subprocess.Popen(
            [str(nginx_exe)],
            cwd=str(nginx_path),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        
        return True, "Nginx started successfully"
    except Exception as e:
        return False, f"Failed to start Nginx: {str(e)}"


def stop_nginx():
    """
    Stop Nginx server
    
    Returns:
        tuple: (success: bool, message: str)
    """
    nginx_path = get_nginx_path()
    if not nginx_path:
        return False, "Nginx not found"
    
    nginx_exe = nginx_path / "nginx.exe"
    
    try:
        result = subprocess.run(
            [str(nginx_exe), "-s", "stop"],
            capture_output=True,
            text=True,
            timeout=10,
            cwd=str(nginx_path)
        )
        
        return True, "Nginx stopped"
    except Exception as e:
        return False, f"Failed to stop Nginx: {str(e)}"


def is_nginx_running():
    """
    Check if Nginx is currently running
    
    Returns:
        bool: True if Nginx is running
    """
    try:
        result = subprocess.run(
            ["tasklist", "/FI", "IMAGENAME eq nginx.exe"],
            capture_output=True,
            text=True,
            timeout=5
        )
        return "nginx.exe" in result.stdout
    except:
        return False


def ensure_nginx_main_config():
    """
    Ensure Nginx main config is properly configured for WordPress Orchestrator
    
    Returns:
        tuple: (success: bool, message: str)
    """
    nginx_path = get_nginx_path()
    if not nginx_path:
        return False, "Nginx not found"
    
    main_conf = nginx_path / "conf" / "nginx.conf"
    
    # We'll maintain a managed config file to avoid parsing complexity
    # This overwrites the default config with our verified structure
    config_content = """
worker_processes 1;

events {
    worker_connections 1024;
}

http {
    include       mime.types;
    default_type  application/octet-stream;
    sendfile        on;
    keepalive_timeout  65;

    # Default server to catch unmatched requests (prevents Welcome Page fallback)
    server {
        listen 80 default_server;
        listen [::]:80 default_server;
        server_name _;
        
        location / {
            add_header Content-Type text/plain;
            return 200 "Nginx is working (Default Server). If you see this, the site config is missing or domain mismatch.";
        }
    }

    # WordPress Orchestrator sites
    include sites/*.conf;
}
"""
    try:
        # Create backup if it doesn't exist
        if main_conf.exists() and not (nginx_path / "conf" / "nginx.conf.original").exists():
            import shutil
            shutil.copy2(main_conf, nginx_path / "conf" / "nginx.conf.original")
            
        with open(main_conf, 'w') as f:
            f.write(config_content)
            
        return True, "nginx.conf updated to managed configuration"
            
    except Exception as e:
        return False, f"Failed to update nginx.conf: {str(e)}"
