"""
Backup Manager for System Database (PostgreSQL)
Handles automated backups, restoration, and retention policies
"""
import os
import subprocess
from datetime import datetime, timedelta
from pathlib import Path
from typing import Tuple, Optional, List
from django.conf import settings


class BackupManager:
    """
    Manages PostgreSQL backups for the control plane database
    """
    
    def __init__(self):
        self.backup_dir = settings.BACKUP_DIR / 'system'
        self.backup_dir.mkdir(parents=True, exist_ok=True)
        self.retention_days = settings.BACKUP_RETENTION_DAYS
    
    def backup_system_db(self) -> Tuple[bool, Optional[str], Optional[str]]:
        """
        Create a pg_dump backup of the PostgreSQL database
        
        Returns:
            Tuple of (success, backup_file_path, error_message)
        """
        # Get database configuration from settings
        db_config = settings.DATABASES['default']
        
        if db_config['ENGINE'] != 'django.db.backends.postgresql':
            return False, None, "System database is not PostgreSQL"
        
        # Generate backup filename with timestamp
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_filename = f"hostinger_platform_{timestamp}.sql"
        backup_path = self.backup_dir / backup_filename
        
        # Build pg_dump command
        env = os.environ.copy()
        env['PGPASSWORD'] = db_config['PASSWORD']
        
        cmd = [
            'pg_dump',
            '-h', db_config['HOST'],
            '-p', str(db_config['PORT']),
            '-U', db_config['USER'],
            '-d', db_config['NAME'],
            '-F', 'p',  # Plain text format
            '--clean',  # Include DROP statements
            '--if-exists',  # Use IF EXISTS for DROP
            '--no-owner',  # Don't include ownership commands
            '--no-privileges',  # Don't include privilege commands
            '-f', str(backup_path)
        ]
        
        try:
            result = subprocess.run(
                cmd,
                env=env,
                capture_output=True,
                text=True,
                timeout=300  # 5 minute timeout
            )
            
            if result.returncode != 0:
                return False, None, f"pg_dump failed: {result.stderr}"
            
            # Verify backup file was created and has content
            if not backup_path.exists() or backup_path.stat().st_size == 0:
                return False, None, "Backup file is empty or was not created"
            
            # Clean up old backups
            self._cleanup_old_backups()
            
            return True, str(backup_path), None
            
        except subprocess.TimeoutExpired:
            return False, None, "Backup operation timed out"
        except Exception as e:
            return False, None, f"Backup failed: {str(e)}"
    
    def restore_system_db(self, backup_file: str) -> Tuple[bool, Optional[str]]:
        """
        Restore PostgreSQL database from a backup file
        
        Args:
            backup_file: Path to .sql backup file
            
        Returns:
            Tuple of (success, error_message)
        """
        if not Path(backup_file).exists():
            return False, f"Backup file not found: {backup_file}"
        
        # Get database configuration
        db_config = settings.DATABASES['default']
        
        if db_config['ENGINE'] != 'django.db.backends.postgresql':
            return False, "System database is not PostgreSQL"
        
        # Build psql command
        env = os.environ.copy()
        env['PGPASSWORD'] = db_config['PASSWORD']
        
        cmd = [
            'psql',
            '-h', db_config['HOST'],
            '-p', str(db_config['PORT']),
            '-U', db_config['USER'],
            '-d', db_config['NAME'],
            '-f', backup_file
        ]
        
        try:
            result = subprocess.run(
                cmd,
                env=env,
                capture_output=True,
                text=True,
                timeout=300
            )
            
            if result.returncode != 0:
                return False, f"Restore failed: {result.stderr}"
            
            return True, None
            
        except subprocess.TimeoutExpired:
            return False, "Restore operation timed out"
        except Exception as e:
            return False, f"Restore failed: {str(e)}"
    
    def _cleanup_old_backups(self):
        """Remove backups older than retention period"""
        cutoff_date = datetime.now() - timedelta(days=self.retention_days)
        
        for backup_file in self.backup_dir.glob('*.sql'):
            # Extract timestamp from filename (format: hostinger_platform_YYYYMMDD_HHMMSS.sql)
            try:
                filename = backup_file.stem
                timestamp_str = filename.split('_')[-2] + '_' + filename.split('_')[-1]
                file_date = datetime.strptime(timestamp_str, '%Y%m%d_%H%M%S')
                
                if file_date < cutoff_date:
                    backup_file.unlink()
                    print(f"Deleted old backup: {backup_file.name}")
            except (ValueError, IndexError):
                # Skip files that don't match expected format
                continue
    
    def list_backups(self) -> List[Dict]:
        """
        List all available backups with metadata
        
        Returns:
            List of dictionaries with backup information
        """
        backups = []
        
        for backup_file in sorted(self.backup_dir.glob('*.sql'), reverse=True):
            try:
                filename = backup_file.stem
                timestamp_str = filename.split('_')[-2] + '_' + filename.split('_')[-1]
                file_date = datetime.strptime(timestamp_str, '%Y%m%d_%H%M%S')
                
                backups.append({
                    'filename': backup_file.name,
                    'path': str(backup_file),
                    'size_mb': round(backup_file.stat().st_size / (1024 * 1024), 2),
                    'created_at': file_date.isoformat(),
                    'age_days': (datetime.now() - file_date).days
                })
            except (ValueError, IndexError):
                continue
        
        return backups
    
    def verify_backup(self, backup_file: str) -> Tuple[bool, Optional[str]]:
        """
        Verify a backup file is valid SQL
        
        Args:
            backup_file: Path to backup file
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        if not Path(backup_file).exists():
            return False, "Backup file does not exist"
        
        # Check file size
        file_size = Path(backup_file).stat().st_size
        if file_size == 0:
            return False, "Backup file is empty"
        
        # Check for SQL content
        try:
            with open(backup_file, 'r') as f:
                first_lines = ''.join([f.readline() for _ in range(10)])
                if 'PostgreSQL database dump' not in first_lines:
                    return False, "File does not appear to be a PostgreSQL dump"
            
            return True, None
        except Exception as e:
            return False, f"Failed to read backup file: {str(e)}"


def schedule_backups():
    """
    Configure automated backup scheduling
    This should be called from a cron job or task scheduler
    """
    manager = BackupManager()
    success, backup_path, error = manager.backup_system_db()
    
    if success:
        print(f"✓ Backup created successfully: {backup_path}")
        return 0
    else:
        print(f"✗ Backup failed: {error}")
        return 1


if __name__ == '__main__':
    # Allow running as a standalone script
    import django
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
    django.setup()
    
    exit(schedule_backups())
