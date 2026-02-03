"""
Cloudflare Tunnel Ingress Manager - Manages dynamic routing configuration
"""
import os
import yaml
import subprocess
from typing import Optional, Dict, List, Tuple
from django.conf import settings


class IngressManager:
    """
    Manages the cloudflared_config.yml file for dynamic subdomain routing.
    Supports adding/removing routes and reloading the tunnel without downtime.
    """
    
    def __init__(self):
        self.config_path = getattr(settings, 'CLOUDFLARE_CONFIG_PATH', None)
        self.domain = getattr(settings, 'CLOUDFLARE_DOMAIN', None)
        self.tunnel_id = getattr(settings, 'CLOUDFLARE_TUNNEL_ID', None)
        self.credentials_file = getattr(settings, 'CLOUDFLARE_CREDENTIALS_FILE', None)
        
        if not all([self.config_path, self.domain, self.tunnel_id, self.credentials_file]):
            raise ValueError(
                "Missing Cloudflare configuration. Please set CLOUDFLARE_CONFIG_PATH, "
                "CLOUDFLARE_DOMAIN, CLOUDFLARE_TUNNEL_ID, and CLOUDFLARE_CREDENTIALS_FILE "
                "in Django settings."
            )
    
    def _load_config(self) -> Dict:
        """Load the current cloudflared configuration"""
        if not os.path.exists(self.config_path):
            # Create default config if it doesn't exist
            return {
                'tunnel': self.tunnel_id,
                'credentials-file': self.credentials_file,
                'ingress': [
                    {'service': 'http_status:404'}  # Default catch-all
                ]
            }
        
        with open(self.config_path, 'r') as f:
            return yaml.safe_load(f)
    
    def _save_config(self, config: Dict) -> None:
        """Save the configuration to file"""
        with open(self.config_path, 'w') as f:
            yaml.dump(config, f, default_flow_style=False, sort_keys=False)
    
    def add_route(self, subdomain: str, port: int) -> Tuple[bool, Optional[str], Optional[str]]:
        """
        Add a new ingress route for a subdomain
        
        Args:
            subdomain: The subdomain (e.g., 'mysite' for mysite.edubricz.online)
            port: The local port to route to
        
        Returns:
            Tuple of (success, public_url, error_message)
        """
        try:
            config = self._load_config()
            
            # Construct the full hostname and public URL
            hostname = f"{subdomain}.{self.domain}"
            public_url = f"https://{hostname}"
            service = f"http://localhost:{port}"
            
            # Check if route already exists
            ingress_rules = config.get('ingress', [])
            for rule in ingress_rules[:-1]:  # Skip the catch-all rule
                if rule.get('hostname') == hostname:
                    # Update existing route
                    rule['service'] = service
                    self._save_config(config)
                    self._reload_tunnel()
                    return True, public_url, None
            
            # Add new route (insert before the catch-all rule)
            new_rule = {
                'hostname': hostname,
                'service': service
            }
            ingress_rules.insert(-1, new_rule)
            config['ingress'] = ingress_rules
            
            self._save_config(config)
            self._reload_tunnel()
            
            return True, public_url, None
            
        except Exception as e:
            return False, None, f"Failed to add route: {str(e)}"
    
    def remove_route(self, subdomain: str) -> Tuple[bool, Optional[str]]:
        """
        Remove an ingress route for a subdomain
        
        Args:
            subdomain: The subdomain to remove
        
        Returns:
            Tuple of (success, error_message)
        """
        try:
            config = self._load_config()
            hostname = f"{subdomain}.{self.domain}"
            
            # Remove the matching rule
            ingress_rules = config.get('ingress', [])
            original_count = len(ingress_rules)
            
            config['ingress'] = [
                rule for rule in ingress_rules 
                if rule.get('hostname') != hostname
            ]
            
            if len(config['ingress']) == original_count:
                return False, f"Route for {hostname} not found"
            
            self._save_config(config)
            self._reload_tunnel()
            
            return True, None
            
        except Exception as e:
            return False, f"Failed to remove route: {str(e)}"
    
    def get_all_routes(self) -> List[Dict[str, str]]:
        """
        Get all current ingress routes (excluding the catch-all)
        
        Returns:
            List of route dictionaries with 'hostname' and 'service' keys
        """
        try:
            config = self._load_config()
            ingress_rules = config.get('ingress', [])
            
            # Filter out the catch-all rule
            return [
                rule for rule in ingress_rules 
                if 'hostname' in rule
            ]
        except Exception as e:
            print(f"Error loading routes: {e}")
            return []
    
    def _reload_tunnel(self) -> bool:
        """
        Reload the tunnel configuration without downtime.
        Sends SIGHUP to the cloudflared process.
        
        Returns:
            True if reload was successful, False otherwise
        """
        try:
            # Find the cloudflared process
            result = subprocess.run(
                ['pgrep', '-f', f'cloudflared.*{self.tunnel_id}'],
                capture_output=True,
                text=True
            )
            
            if result.returncode != 0:
                print("Warning: cloudflared process not found. Configuration saved but not reloaded.")
                return False
            
            pid = result.stdout.strip().split('\n')[0]
            
            # Send SIGHUP to reload
            subprocess.run(['kill', '-HUP', pid], check=True)
            print(f"Tunnel configuration reloaded (PID: {pid})")
            return True
            
        except Exception as e:
            print(f"Warning: Failed to reload tunnel: {e}")
            return False
    
    def get_public_url(self, subdomain: str) -> str:
        """
        Get the public URL for a subdomain
        
        Args:
            subdomain: The subdomain
        
        Returns:
            The full public URL
        """
        return f"https://{subdomain}.{self.domain}"
    
    def validate_subdomain(self, subdomain: str) -> Tuple[bool, Optional[str]]:
        """
        Validate a subdomain name
        
        Args:
            subdomain: The subdomain to validate
        
        Returns:
            Tuple of (is_valid, error_message)
        """
        if not subdomain:
            return False, "Subdomain cannot be empty"
        
        if len(subdomain) > 63:
            return False, "Subdomain must be 63 characters or less"
        
        # Check for valid characters (alphanumeric and hyphens)
        import re
        if not re.match(r'^[a-z0-9]([a-z0-9-]*[a-z0-9])?$', subdomain.lower()):
            return False, "Subdomain can only contain lowercase letters, numbers, and hyphens"
        
        return True, None
