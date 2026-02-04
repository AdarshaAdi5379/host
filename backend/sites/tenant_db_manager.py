"""
Tenant Database Manager
Manages isolated MySQL containers for WordPress sites (Data Plane)
"""
import docker
import secrets
import string
from typing import Tuple, Optional, Dict
from django.conf import settings


class TenantDatabaseManager:
    """
    Manages isolated MySQL 8.0 containers for WordPress tenant databases.
    Each WordPress site gets its own MySQL container for complete data isolation.
    """
    
    def __init__(self):
        self.client = docker.from_env()
        self.db_image = settings.TENANT_DB_IMAGE
        self.network_name = settings.TENANT_DB_NETWORK
        self._ensure_network_exists()
    
    def _ensure_network_exists(self):
        """Create isolated network for tenant databases if it doesn't exist"""
        try:
            self.client.networks.get(self.network_name)
        except docker.errors.NotFound:
            # Create isolated network for tenant databases
            self.client.networks.create(
                self.network_name,
                driver="bridge",
                internal=False,  # Allow WordPress containers to connect
                labels={
                    "purpose": "tenant-database-isolation",
                    "managed-by": "hostinger-platform"
                }
            )
    
    def _generate_secure_password(self, length: int = 32) -> str:
        """Generate a cryptographically secure password"""
        alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
        return ''.join(secrets.choice(alphabet) for _ in range(length))
    
    def create_tenant_database(self, site_name: str) -> Tuple[bool, Optional[Dict], Optional[str]]:
        """
        Create an isolated MySQL container for a WordPress site
        
        Args:
            site_name: Unique identifier for the site
            
        Returns:
            Tuple of (success, db_config, error_message)
            db_config contains: {
                'container_name': str,
                'db_host': str,
                'db_port': int,
                'db_name': str,
                'db_user': str,
                'db_password': str,
                'root_password': str
            }
        """
        container_name = f"{site_name}_mysql"
        
        # Check if container already exists
        try:
            existing = self.client.containers.get(container_name)
            return False, None, f"Database container '{container_name}' already exists"
        except docker.errors.NotFound:
            pass
        
        # Generate secure credentials
        root_password = self._generate_secure_password()
        db_password = self._generate_secure_password()
        db_name = "wordpress"
        db_user = "wordpress"
        
        try:
            # Create MySQL container
            container = self.client.containers.run(
                self.db_image,
                name=container_name,
                environment={
                    'MYSQL_ROOT_PASSWORD': root_password,
                    'MYSQL_DATABASE': db_name,
                    'MYSQL_USER': db_user,
                    'MYSQL_PASSWORD': db_password,
                    'MYSQL_ROOT_HOST': '%',  # Allow root from any host (within Docker network)
                },
                network=self.network_name,
                detach=True,
                restart_policy={"Name": "unless-stopped"},
                labels={
                    "site": site_name,
                    "purpose": "wordpress-database",
                    "managed-by": "hostinger-platform"
                },
                # Security: No port exposure to host (only accessible via Docker network)
                # ports={'3306/tcp': None}  # Explicitly no port mapping
            )
            
            # Wait for MySQL to be ready
            import time
            max_wait = 30  # seconds
            waited = 0
            while waited < max_wait:
                container.reload()
                if container.status == 'running':
                    # Check if MySQL is accepting connections
                    exit_code, output = container.exec_run(
                        "mysqladmin ping -h localhost -u root -p" + root_password,
                        demux=True
                    )
                    if exit_code == 0:
                        break
                time.sleep(2)
                waited += 2
            
            db_config = {
                'container_name': container_name,
                'container_id': container.id,
                'db_host': container_name,  # Use container name as hostname in Docker network
                'db_port': 3306,
                'db_name': db_name,
                'db_user': db_user,
                'db_password': db_password,
                'root_password': root_password,
                'network': self.network_name
            }
            
            return True, db_config, None
            
        except docker.errors.APIError as e:
            return False, None, f"Docker API error: {str(e)}"
        except Exception as e:
            return False, None, f"Failed to create tenant database: {str(e)}"
    
    def get_tenant_db_config(self, site_name: str) -> Optional[Dict]:
        """
        Retrieve database configuration for an existing tenant
        
        Note: Passwords cannot be retrieved from running containers.
        This should be stored securely in the Django database.
        """
        container_name = f"{site_name}_mysql"
        
        try:
            container = self.client.containers.get(container_name)
            return {
                'container_name': container_name,
                'container_id': container.id,
                'db_host': container_name,
                'db_port': 3306,
                'status': container.status,
                'network': self.network_name
            }
        except docker.errors.NotFound:
            return None
    
    def remove_tenant_database(self, site_name: str, remove_volumes: bool = True) -> Tuple[bool, Optional[str]]:
        """
        Remove a tenant's MySQL container
        
        Args:
            site_name: Site identifier
            remove_volumes: Whether to delete data volumes (default: True)
            
        Returns:
            Tuple of (success, error_message)
        """
        container_name = f"{site_name}_mysql"
        
        try:
            container = self.client.containers.get(container_name)
            
            # Stop container
            if container.status == 'running':
                container.stop(timeout=10)
            
            # Remove container and volumes
            container.remove(v=remove_volumes, force=True)
            
            return True, None
            
        except docker.errors.NotFound:
            return True, None  # Already removed
        except docker.errors.APIError as e:
            return False, f"Docker API error: {str(e)}"
        except Exception as e:
            return False, f"Failed to remove tenant database: {str(e)}"
    
    def snapshot_tenant_database(self, site_name: str, root_password: str) -> Tuple[bool, Optional[str], Optional[str]]:
        """
        Create a mysqldump backup of a tenant database
        
        Args:
            site_name: Site identifier
            root_password: MySQL root password for the container
            
        Returns:
            Tuple of (success, backup_file_path, error_message)
        """
        container_name = f"{site_name}_mysql"
        
        try:
            container = self.client.containers.get(container_name)
            
            if container.status != 'running':
                return False, None, "Container is not running"
            
            # Generate backup filename with timestamp
            from datetime import datetime
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            backup_filename = f"{site_name}_backup_{timestamp}.sql"
            backup_path = settings.BACKUP_DIR / 'tenants' / backup_filename
            
            # Ensure backup directory exists
            backup_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Execute mysqldump inside container
            dump_cmd = f"mysqldump -u root -p{root_password} --all-databases --single-transaction"
            exit_code, output = container.exec_run(dump_cmd, demux=True)
            
            if exit_code != 0:
                stderr = output[1].decode() if output[1] else "Unknown error"
                return False, None, f"mysqldump failed: {stderr}"
            
            # Write backup to file
            stdout = output[0]
            with open(backup_path, 'wb') as f:
                f.write(stdout)
            
            return True, str(backup_path), None
            
        except docker.errors.NotFound:
            return False, None, f"Container '{container_name}' not found"
        except Exception as e:
            return False, None, f"Backup failed: {str(e)}"
    
    def restore_tenant_database(self, site_name: str, backup_file: str, root_password: str) -> Tuple[bool, Optional[str]]:
        """
        Restore a tenant database from a backup file
        
        Args:
            site_name: Site identifier
            backup_file: Path to .sql backup file
            root_password: MySQL root password
            
        Returns:
            Tuple of (success, error_message)
        """
        container_name = f"{site_name}_mysql"
        
        try:
            container = self.client.containers.get(container_name)
            
            if container.status != 'running':
                return False, "Container is not running"
            
            # Read backup file
            with open(backup_file, 'rb') as f:
                sql_content = f.read()
            
            # Execute mysql restore
            restore_cmd = f"mysql -u root -p{root_password}"
            exit_code, output = container.exec_run(
                restore_cmd,
                stdin=True,
                demux=True
            )
            
            # Send SQL content to stdin
            container.exec_run(restore_cmd, stdin=sql_content)
            
            return True, None
            
        except docker.errors.NotFound:
            return False, f"Container '{container_name}' not found"
        except Exception as e:
            return False, f"Restore failed: {str(e)}"
