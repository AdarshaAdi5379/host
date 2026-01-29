"""
Windows Hosts File Manager for WordPress Orchestrator
Automatically manages hosts file entries for .local domains
"""
import os
import ctypes
import shutil
from pathlib import Path
from datetime import datetime


HOSTS_FILE_PATH = r"C:\Windows\System32\drivers\etc\hosts"
ORCHESTRATOR_MARKER_START = "# WordPress Orchestrator - Managed Entries (DO NOT EDIT MANUALLY)"
ORCHESTRATOR_MARKER_END = "# End WordPress Orchestrator Entries"


def is_admin():
    """Check if the current process has administrator privileges"""
    try:
        return ctypes.windll.shell32.IsUserAnAdmin()
    except:
        return False


def backup_hosts_file():
    """Create a backup of the hosts file before modification"""
    try:
        backup_path = f"{HOSTS_FILE_PATH}.backup.{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        shutil.copy2(HOSTS_FILE_PATH, backup_path)
        return True, backup_path
    except Exception as e:
        return False, str(e)


def read_hosts_file():
    """Read the current hosts file content"""
    try:
        with open(HOSTS_FILE_PATH, 'r') as f:
            return f.read()
    except Exception as e:
        raise RuntimeError(f"Failed to read hosts file: {str(e)}")


def write_hosts_file(content):
    """Write content to the hosts file"""
    try:
        with open(HOSTS_FILE_PATH, 'w') as f:
            f.write(content)
        return True
    except PermissionError:
        raise RuntimeError("Permission denied. Django must run as administrator to modify hosts file.")
    except Exception as e:
        raise RuntimeError(f"Failed to write hosts file: {str(e)}")


def get_managed_entries():
    """Extract WordPress Orchestrator managed entries from hosts file"""
    content = read_hosts_file()
    
    if ORCHESTRATOR_MARKER_START not in content:
        return []
    
    # Extract managed section
    start_idx = content.find(ORCHESTRATOR_MARKER_START)
    end_idx = content.find(ORCHESTRATOR_MARKER_END)
    
    if start_idx == -1 or end_idx == -1:
        return []
    
    managed_section = content[start_idx:end_idx]
    entries = []
    
    for line in managed_section.split('\n'):
        line = line.strip()
        if line and not line.startswith('#'):
            parts = line.split()
            if len(parts) >= 2:
                entries.append(parts[1])  # domain name
    
    return entries


def add_hosts_entry(domain):
    """
    Add a .local domain entry to the hosts file
    
    Args:
        domain: Domain name (e.g., 'mysite.local')
    
    Returns:
        tuple: (success: bool, message: str)
    """
    if not is_admin():
        return False, "Administrator privileges required. Please run Django as administrator."
    
    # Backup first
    backup_success, backup_info = backup_hosts_file()
    if not backup_success:
        return False, f"Failed to create backup: {backup_info}"
    
    try:
        content = read_hosts_file()
        
        # Check if domain already exists
        if f"127.0.0.1 {domain}" in content or f"127.0.0.1\t{domain}" in content:
            return True, f"Domain {domain} already exists in hosts file"
        
        # Find or create managed section
        if ORCHESTRATOR_MARKER_START not in content:
            # Create new managed section
            managed_section = f"\n{ORCHESTRATOR_MARKER_START}\n127.0.0.1 {domain}\n{ORCHESTRATOR_MARKER_END}\n"
            content += managed_section
        else:
            # Add to existing managed section
            end_marker_idx = content.find(ORCHESTRATOR_MARKER_END)
            new_entry = f"127.0.0.1 {domain}\n"
            content = content[:end_marker_idx] + new_entry + content[end_marker_idx:]
        
        # Write updated content
        write_hosts_file(content)
        return True, f"Successfully added {domain} to hosts file"
        
    except Exception as e:
        return False, f"Failed to add hosts entry: {str(e)}"


def remove_hosts_entry(domain):
    """
    Remove a .local domain entry from the hosts file
    
    Args:
        domain: Domain name to remove (e.g., 'mysite.local')
    
    Returns:
        tuple: (success: bool, message: str)
    """
    if not is_admin():
        return False, "Administrator privileges required. Please run Django as administrator."
    
    # Backup first
    backup_success, backup_info = backup_hosts_file()
    if not backup_success:
        return False, f"Failed to create backup: {backup_info}"
    
    try:
        content = read_hosts_file()
        
        # Remove the entry
        lines = content.split('\n')
        new_lines = []
        
        for line in lines:
            # Skip lines that match our domain
            if f"127.0.0.1 {domain}" in line or f"127.0.0.1\t{domain}" in line:
                continue
            new_lines.append(line)
        
        # Write updated content
        content = '\n'.join(new_lines)
        write_hosts_file(content)
        return True, f"Successfully removed {domain} from hosts file"
        
    except Exception as e:
        return False, f"Failed to remove hosts entry: {str(e)}"


def cleanup_all_entries():
    """
    Remove all WordPress Orchestrator managed entries from hosts file
    Useful for cleanup or reset
    
    Returns:
        tuple: (success: bool, message: str)
    """
    if not is_admin():
        return False, "Administrator privileges required"
    
    try:
        content = read_hosts_file()
        
        # Remove entire managed section
        if ORCHESTRATOR_MARKER_START in content:
            start_idx = content.find(ORCHESTRATOR_MARKER_START)
            end_idx = content.find(ORCHESTRATOR_MARKER_END)
            
            if start_idx != -1 and end_idx != -1:
                # Remove from start marker to end marker (inclusive)
                end_idx += len(ORCHESTRATOR_MARKER_END)
                content = content[:start_idx] + content[end_idx:]
                write_hosts_file(content)
                return True, "All WordPress Orchestrator entries removed"
        
        return True, "No managed entries found"
        
    except Exception as e:
        return False, f"Failed to cleanup entries: {str(e)}"
