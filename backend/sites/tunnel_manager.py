"""
Cloudflare Tunnel Manager - Manages cloudflared tunnel lifecycle
"""
import subprocess
import re
import os
import signal
import shutil
import time
from typing import Optional, Tuple


def check_cloudflared_installed() -> bool:
    """
    Check if cloudflared binary is available in the system PATH
    
    Returns:
        bool: True if cloudflared is installed, False otherwise
    """
    return shutil.which('cloudflared') is not None


def start_tunnel(port: int) -> Tuple[Optional[int], Optional[str], Optional[str]]:
    """
    Start a Cloudflare tunnel for the given port
    
    Args:
        port: The local port to tunnel (e.g., 9000)
    
    Returns:
        Tuple of (process_id, tunnel_url, error_message)
        - process_id: PID of the cloudflared process (None on failure)
        - tunnel_url: The public Cloudflare URL (None on failure)
        - error_message: Error description (None on success)
    """
    if not check_cloudflared_installed():
        return None, None, "cloudflared binary not found. Please install it first."
    
    try:
        # Start cloudflared tunnel
        process = subprocess.Popen(
            ['cloudflared', 'tunnel', '--url', f'http://localhost:{port}'],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1
        )
        
        # Wait for tunnel URL to appear in output (usually takes 3-8 seconds)
        tunnel_url = None
        timeout = 15  # Maximum wait time in seconds
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            # Check if process is still running
            if process.poll() is not None:
                stderr = process.stderr.read()
                return None, None, f"cloudflared process terminated unexpectedly: {stderr}"
            
            # Read a line from stderr (cloudflared outputs to stderr)
            line = process.stderr.readline()
            
            if line:
                # Extract tunnel URL using regex
                # Format: https://random-subdomain-1234.trycloudflare.com
                match = re.search(r'https://[a-z0-9-]+\.trycloudflare\.com', line)
                if match:
                    tunnel_url = match.group(0)
                    break
            
            time.sleep(0.1)
        
        if not tunnel_url:
            # Timeout - kill the process
            process.terminate()
            return None, None, "Timeout waiting for tunnel URL. Please try again."
        
        return process.pid, tunnel_url, None
        
    except FileNotFoundError:
        return None, None, "cloudflared command not found"
    except Exception as e:
        return None, None, f"Failed to start tunnel: {str(e)}"


def stop_tunnel(pid: int) -> Tuple[bool, Optional[str]]:
    """
    Stop a running Cloudflare tunnel by process ID
    
    Args:
        pid: Process ID of the cloudflared process
    
    Returns:
        Tuple of (success, error_message)
    """
    if not pid:
        return False, "No process ID provided"
    
    try:
        # Check if process exists
        if not is_tunnel_alive(pid):
            return True, None  # Already stopped
        
        # Terminate the process
        os.kill(pid, signal.SIGTERM)
        
        # Wait for process to terminate (max 5 seconds)
        for _ in range(50):
            if not is_tunnel_alive(pid):
                return True, None
            time.sleep(0.1)
        
        # Force kill if still running
        os.kill(pid, signal.SIGKILL)
        return True, None
        
    except ProcessLookupError:
        # Process already terminated
        return True, None
    except PermissionError:
        return False, "Permission denied to terminate tunnel process"
    except Exception as e:
        return False, f"Failed to stop tunnel: {str(e)}"


def is_tunnel_alive(pid: int) -> bool:
    """
    Check if a tunnel process is still running
    
    Args:
        pid: Process ID to check
    
    Returns:
        bool: True if process is running, False otherwise
    """
    if not pid:
        return False
    
    try:
        # Send signal 0 to check if process exists
        os.kill(pid, 0)
        return True
    except (ProcessLookupError, PermissionError):
        return False


def extract_tunnel_url(output: str) -> Optional[str]:
    """
    Extract Cloudflare tunnel URL from cloudflared output
    
    Args:
        output: stdout/stderr from cloudflared process
    
    Returns:
        The tunnel URL if found, None otherwise
    """
    match = re.search(r'https://[a-z0-9-]+\.trycloudflare\.com', output)
    return match.group(0) if match else None


def get_installation_instructions() -> str:
    """
    Get platform-specific installation instructions for cloudflared
    
    Returns:
        Installation instructions as a string
    """
    import platform
    
    system = platform.system().lower()
    
    if system == 'windows':
        return (
            "Download cloudflared for Windows:\n"
            "1. Visit: https://github.com/cloudflare/cloudflared/releases\n"
            "2. Download 'cloudflared-windows-amd64.exe'\n"
            "3. Rename to 'cloudflared.exe'\n"
            "4. Add to system PATH or place in backend directory"
        )
    elif system == 'linux':
        return (
            "Install cloudflared on Linux:\n"
            "wget -O cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64\n"
            "chmod +x cloudflared\n"
            "sudo mv cloudflared /usr/local/bin/"
        )
    elif system == 'darwin':
        return (
            "Install cloudflared on macOS:\n"
            "brew install cloudflared\n"
            "OR\n"
            "wget -O cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-amd64\n"
            "chmod +x cloudflared\n"
            "sudo mv cloudflared /usr/local/bin/"
        )
    else:
        return "Visit https://github.com/cloudflare/cloudflared/releases for installation instructions"
