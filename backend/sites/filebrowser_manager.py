"""
FileBrowser User Management Service
Manages FileBrowser users via Docker exec commands for multi-tenant file access
Uses a retry mechanism to handle database locking issues
"""
import subprocess
import secrets
import time
import string
import re
from typing import Dict, Optional


class FileBrowserManager:
    """
    Service class for managing FileBrowser users with scoped access
    Each WordPress site gets a dedicated FileBrowser user with access restricted to their directory
    """
    
    CONTAINER_NAME = "hostinger_files"
    COMPOSE_DIR = "/home/adarsha/Desktop/projects/HOST/host/backend/filebrowser"
    BASE_SCOPE = ""  # Empty because /srv is already the root mount in FileBrowser
    
    def __init__(self):
        """Initialize the FileBrowser manager"""
        pass
    
    @staticmethod
    def generate_credentials(site_name: str) -> Dict[str, str]:
        """
        Generate FileBrowser credentials for a site
        
        Args:
            site_name: Name of the WordPress site
            
        Returns:
            dict: {'username': str, 'password': str}
        """
        slug = re.sub(r'[^a-zA-Z0-9_.-]', '_', site_name.strip())
        slug = slug.strip('_.-') or "site"
        username = f"fb_{slug[:48]}"
        # Keep password strictly alphanumeric so CLI parsing never mistakes it for flags.
        alphabet = string.ascii_letters + string.digits
        password = ''.join(secrets.choice(alphabet) for _ in range(24))
        
        return {
            'username': username,
            'password': password
        }
    
    def create_user_with_retry(self, site_name: str, username: str, password: str, max_retries: int = 3) -> Dict:
        """
        Create a scoped FileBrowser user with retry logic
        
        Args:
            site_name: Name of the WordPress site (used for scope)
            username: FileBrowser username
            password: FileBrowser password
            max_retries: Maximum number of retry attempts
            
        Returns:
            dict: {'success': bool, 'error': str (if failed)}
        """
        scope = f"/{site_name}"  # e.g., /test37 (since /srv is already the root)
        
        for attempt in range(max_retries):
            try:
                # Execute: docker exec hostinger_files filebrowser users add <username> <password> --scope <scope>
                result = subprocess.run(
                    [
                        'docker', 'exec', self.CONTAINER_NAME,
                        'filebrowser', 'users', 'add', username, password,
                        '--scope', scope
                    ],
                    capture_output=True,
                    text=True,
                    timeout=20
                )
                
                if result.returncode == 0:
                    return {'success': True}
                else:
                    error_msg = result.stderr or result.stdout or 'Unknown error'

                    # Fallback path: if live DB is locked/timeing out, do an offline one-off command.
                    if 'timeout' in error_msg.lower():
                        fallback = self._run_compose_user_command(
                            ['users', 'add', username, password, '--scope', scope],
                            timeout=40,
                        )
                        if fallback['success']:
                            return {'success': True}
                        error_msg = f"{error_msg} | fallback failed: {fallback.get('error')}"
                    
                    # If it's a timeout error and we have retries left, try again
                    if 'timeout' in error_msg.lower() and attempt < max_retries - 1:
                        time.sleep(2)
                        continue
                    
                    return {
                        'success': False,
                        'error': f'Failed to create FileBrowser user: {error_msg}'
                    }
                    
            except subprocess.TimeoutExpired:
                if attempt < max_retries - 1:
                    time.sleep(2)
                    continue
                return {
                    'success': False,
                    'error': 'FileBrowser user creation timed out after retries'
                }
            except FileNotFoundError:
                return {
                    'success': False,
                    'error': 'Docker command not found. Is Docker installed?'
                }
            except Exception as e:
                return {
                    'success': False,
                    'error': f'Unexpected error creating FileBrowser user: {str(e)}'
                }
        
        return {
            'success': False,
            'error': 'Failed after maximum retries'
        }

    def _run_compose_user_command(self, args: list[str], timeout: int = 40) -> Dict:
        """
        Run filebrowser user commands in offline mode to avoid sqlite lock timeouts.
        """
        try:
            subprocess.run(
                ['docker', 'compose', 'down'],
                cwd=self.COMPOSE_DIR,
                capture_output=True,
                text=True,
                timeout=30,
            )

            result = subprocess.run(
                ['docker', 'compose', 'run', '--rm', 'filebrowser', *args],
                cwd=self.COMPOSE_DIR,
                capture_output=True,
                text=True,
                timeout=timeout,
            )

            if result.returncode == 0:
                return {'success': True}
            return {'success': False, 'error': result.stderr or result.stdout or 'Unknown error'}
        except Exception as e:
            return {'success': False, 'error': f'Compose fallback failed: {str(e)}'}
        finally:
            try:
                subprocess.run(
                    ['docker', 'compose', 'up', '-d'],
                    cwd=self.COMPOSE_DIR,
                    capture_output=True,
                    text=True,
                    timeout=30,
                )
            except Exception:
                # Keep caller error focused on the main operation.
                pass
    
    def create_user(self, site_name: str, username: str, password: str) -> Dict:
        """
        Create a scoped FileBrowser user (wrapper for backward compatibility)
        
        Args:
            site_name: Name of the WordPress site (used for scope)
            username: FileBrowser username
            password: FileBrowser password
            
        Returns:
            dict: {'success': bool, 'error': str (if failed)}
        """
        # Try once without retry for backward compatibility
        # The view layer can decide whether to use retry version
        return self.create_user_with_retry(site_name, username, password, max_retries=3)
    
    def delete_user(self, username: str) -> Dict:
        """
        Delete a FileBrowser user
        
        Args:
            username: FileBrowser username to delete
            
        Returns:
            dict: {'success': bool, 'error': str (if failed)}
        """
        try:
            # Execute: docker exec hostinger_files filebrowser users rm <username>
            result = subprocess.run(
                [
                    'docker', 'exec', self.CONTAINER_NAME,
                    'filebrowser', 'users', 'rm', username
                ],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            if result.returncode == 0:
                return {'success': True}
            else:
                error_msg = result.stderr or result.stdout or 'Unknown error'
                return {
                    'success': False,
                    'error': f'Failed to delete FileBrowser user: {error_msg}'
                }
                
        except subprocess.TimeoutExpired:
            return {
                'success': False,
                'error': 'FileBrowser user deletion timed out'
            }
        except FileNotFoundError:
            return {
                'success': False,
                'error': 'Docker command not found. Is Docker installed?'
            }
        except Exception as e:
            return {
                'success': False,
                'error': f'Unexpected error deleting FileBrowser user: {str(e)}'
            }
    
    def user_exists(self, username: str) -> bool:
        """
        Check if a FileBrowser user exists
        
        Args:
            username: FileBrowser username to check
            
        Returns:
            bool: True if user exists, False otherwise
        """
        try:
            # Execute: docker exec hostinger_files filebrowser users ls
            result = subprocess.run(
                [
                    'docker', 'exec', self.CONTAINER_NAME,
                    'filebrowser', 'users', 'ls'
                ],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            if result.returncode == 0:
                # Check if username appears in the output
                return username in result.stdout
            else:
                return False
                
        except Exception:
            return False
    
    def container_running(self) -> bool:
        """
        Check if the FileBrowser container is running
        
        Returns:
            bool: True if container is running, False otherwise
        """
        try:
            result = subprocess.run(
                ['docker', 'inspect', '-f', '{{.State.Running}}', self.CONTAINER_NAME],
                capture_output=True,
                text=True,
                timeout=5
            )
            
            return result.returncode == 0 and result.stdout.strip() == 'true'
            
        except Exception:
            return False
