"""
Cloudflare Zone Manager - Service for managing Cloudflare Zones via API
"""
import os
import requests
from typing import Dict, Optional, List
from django.conf import settings


class CloudflareZoneManager:
    """
    Service class for interacting with Cloudflare Zone API
    Handles zone creation, status checking, and deletion
    """
    
    BASE_URL = "https://api.cloudflare.com/client/v4"
    
    def __init__(self):
        self.api_token = os.getenv('CLOUDFLARE_API_TOKEN')
        self.account_id = os.getenv('CLOUDFLARE_ACCOUNT_ID')
        
        if not self.api_token or not self.account_id:
            raise ValueError(
                "Missing Cloudflare credentials. "
                "Please set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID in .env"
            )
        
        self.headers = {
            'Authorization': f'Bearer {self.api_token}',
            'Content-Type': 'application/json'
        }
    
    def create_zone(self, domain_name: str) -> Dict:
        """
        Create a new Cloudflare Zone for the given domain
        
        Args:
            domain_name: Domain to create zone for (e.g., "myshop.com")
        
        Returns:
            dict: {
                'success': bool,
                'zone_id': str,
                'nameservers': list,
                'error': str (if failed)
            }
        """
        url = f"{self.BASE_URL}/zones"
        
        payload = {
            "name": domain_name,
            "account": {
                "id": self.account_id
            },
            "type": "full"  # Full DNS setup (requires nameserver change)
        }
        
        try:
            response = requests.post(url, json=payload, headers=self.headers, timeout=10)
            data = response.json()
            
            if response.status_code == 200 and data.get('success'):
                result = data['result']
                return {
                    'success': True,
                    'zone_id': result['id'],
                    'nameservers': result.get('name_servers', []),
                    'status': result.get('status', 'pending')
                }
            else:
                errors = data.get('errors', [])
                error_msg = errors[0].get('message', 'Unknown error') if errors else 'Zone creation failed'
                return {
                    'success': False,
                    'error': error_msg
                }
        
        except requests.exceptions.RequestException as e:
            return {
                'success': False,
                'error': f'Network error: {str(e)}'
            }
    
    def get_zone_status(self, zone_id: str) -> Dict:
        """
        Check the activation status of a zone
        
        Args:
            zone_id: Cloudflare Zone ID
        
        Returns:
            dict: {
                'success': bool,
                'status': str ('active', 'pending', etc.),
                'nameservers': list,
                'error': str (if failed)
            }
        """
        url = f"{self.BASE_URL}/zones/{zone_id}"
        
        try:
            response = requests.get(url, headers=self.headers, timeout=10)
            data = response.json()
            
            if response.status_code == 200 and data.get('success'):
                result = data['result']
                return {
                    'success': True,
                    'status': result.get('status', 'unknown'),
                    'nameservers': result.get('name_servers', [])
                }
            else:
                return {
                    'success': False,
                    'error': 'Failed to fetch zone status'
                }
        
        except requests.exceptions.RequestException as e:
            return {
                'success': False,
                'error': f'Network error: {str(e)}'
            }
    
    def delete_zone(self, zone_id: str) -> Dict:
        """
        Delete a Cloudflare Zone
        
        Args:
            zone_id: Cloudflare Zone ID
        
        Returns:
            dict: {
                'success': bool,
                'error': str (if failed)
            }
        """
        url = f"{self.BASE_URL}/zones/{zone_id}"
        
        try:
            response = requests.delete(url, headers=self.headers, timeout=10)
            data = response.json()
            
            if response.status_code == 200 and data.get('success'):
                return {'success': True}
            else:
                errors = data.get('errors', [])
                error_msg = errors[0].get('message', 'Unknown error') if errors else 'Zone deletion failed'
                return {
                    'success': False,
                    'error': error_msg
                }
        
        except requests.exceptions.RequestException as e:
            return {
                'success': False,
                'error': f'Network error: {str(e)}'
            }
