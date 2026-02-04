"""
S3 Backup Manager
Handles automated backups to AWS S3 for disaster recovery
"""
import boto3
import gzip
import os
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Optional, Dict, Tuple
from django.conf import settings
from botocore.exceptions import ClientError, NoCredentialsError


class S3BackupManager:
    """
    Manages encrypted backups to AWS S3 for disaster recovery.
    Implements the "Dump, Zip, Ship" strategy for tenant databases.
    """
    
    def __init__(self):
        """Initialize S3 client with credentials from settings"""
        self.bucket_name = settings.AWS_S3_BUCKET_NAME
        self.region = settings.AWS_S3_REGION
        self.retention_days = settings.S3_BACKUP_RETENTION_DAYS
        
        # Initialize S3 client
        self.s3_client = boto3.client(
            's3',
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=self.region
        )
    
    def verify_credentials(self) -> Tuple[bool, Optional[str]]:
        """
        Verify AWS credentials and bucket access
        
        Returns:
            Tuple of (success, error_message)
        """
        try:
            # Try to list objects in bucket (minimal operation)
            self.s3_client.head_bucket(Bucket=self.bucket_name)
            return True, None
        except NoCredentialsError:
            return False, "AWS credentials not found or invalid"
        except ClientError as e:
            error_code = e.response['Error']['Code']
            if error_code == '404':
                return False, f"Bucket '{self.bucket_name}' does not exist"
            elif error_code == '403':
                return False, f"Access denied to bucket '{self.bucket_name}'"
            else:
                return False, f"AWS error: {str(e)}"
        except Exception as e:
            return False, f"Unexpected error: {str(e)}"
    
    def upload_backup(
        self, 
        file_path: str, 
        site_name: str,
        backup_type: str = 'tenant'
    ) -> Tuple[bool, Optional[str], Optional[str]]:
        """
        Upload a compressed backup file to S3
        
        Args:
            file_path: Path to the .sql.gz backup file
            site_name: Name of the site (for organizing in S3)
            backup_type: 'tenant' or 'system'
            
        Returns:
            Tuple of (success, s3_key, error_message)
        """
        try:
            # Generate S3 key with timestamp
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f"{site_name}_{timestamp}.sql.gz"
            s3_key = f"backups/{backup_type}s/{site_name}/{filename}"
            
            # Upload with server-side encryption
            with open(file_path, 'rb') as f:
                self.s3_client.put_object(
                    Bucket=self.bucket_name,
                    Key=s3_key,
                    Body=f,
                    ServerSideEncryption='AES256',  # SSE-S3
                    StorageClass='STANDARD',  # Free tier eligible
                    Metadata={
                        'site_name': site_name,
                        'backup_type': backup_type,
                        'created_at': timestamp
                    }
                )
            
            return True, s3_key, None
            
        except FileNotFoundError:
            return False, None, f"Backup file not found: {file_path}"
        except ClientError as e:
            return False, None, f"S3 upload failed: {str(e)}"
        except Exception as e:
            return False, None, f"Upload error: {str(e)}"
    
    def list_backups(
        self, 
        site_name: Optional[str] = None,
        backup_type: str = 'tenant'
    ) -> List[Dict]:
        """
        List all backups in S3, optionally filtered by site
        
        Args:
            site_name: Optional site name to filter by
            backup_type: 'tenant' or 'system'
            
        Returns:
            List of backup metadata dicts
        """
        try:
            prefix = f"backups/{backup_type}s/"
            if site_name:
                prefix += f"{site_name}/"
            
            response = self.s3_client.list_objects_v2(
                Bucket=self.bucket_name,
                Prefix=prefix
            )
            
            backups = []
            if 'Contents' in response:
                for obj in response['Contents']:
                    backups.append({
                        'key': obj['Key'],
                        'size_bytes': obj['Size'],
                        'size_mb': round(obj['Size'] / (1024 * 1024), 2),
                        'last_modified': obj['LastModified'],
                        'storage_class': obj.get('StorageClass', 'STANDARD')
                    })
            
            # Sort by last modified (newest first)
            backups.sort(key=lambda x: x['last_modified'], reverse=True)
            return backups
            
        except ClientError as e:
            print(f"Error listing backups: {str(e)}")
            return []
    
    def delete_old_backups(
        self, 
        retention_days: Optional[int] = None
    ) -> Tuple[int, List[str]]:
        """
        Delete backups older than retention period
        
        Args:
            retention_days: Number of days to keep (default from settings)
            
        Returns:
            Tuple of (count_deleted, list_of_deleted_keys)
        """
        if retention_days is None:
            retention_days = self.retention_days
        
        cutoff_date = datetime.now() - timedelta(days=retention_days)
        deleted_keys = []
        
        try:
            # List all backups
            response = self.s3_client.list_objects_v2(
                Bucket=self.bucket_name,
                Prefix='backups/'
            )
            
            if 'Contents' not in response:
                return 0, []
            
            # Find and delete old backups
            for obj in response['Contents']:
                if obj['LastModified'].replace(tzinfo=None) < cutoff_date:
                    self.s3_client.delete_object(
                        Bucket=self.bucket_name,
                        Key=obj['Key']
                    )
                    deleted_keys.append(obj['Key'])
            
            return len(deleted_keys), deleted_keys
            
        except ClientError as e:
            print(f"Error deleting old backups: {str(e)}")
            return 0, []
    
    def download_backup(
        self, 
        s3_key: str, 
        destination: str
    ) -> Tuple[bool, Optional[str]]:
        """
        Download a backup from S3 to local filesystem
        
        Args:
            s3_key: S3 object key
            destination: Local file path to save to
            
        Returns:
            Tuple of (success, error_message)
        """
        try:
            # Ensure destination directory exists
            Path(destination).parent.mkdir(parents=True, exist_ok=True)
            
            # Download file
            self.s3_client.download_file(
                Bucket=self.bucket_name,
                Key=s3_key,
                Filename=destination
            )
            
            return True, None
            
        except ClientError as e:
            error_code = e.response['Error']['Code']
            if error_code == '404':
                return False, f"Backup not found: {s3_key}"
            else:
                return False, f"Download failed: {str(e)}"
        except Exception as e:
            return False, f"Download error: {str(e)}"
    
    def get_backup_stats(self) -> Dict:
        """
        Get statistics about S3 backups
        
        Returns:
            Dict with total count, total size, oldest/newest dates
        """
        try:
            response = self.s3_client.list_objects_v2(
                Bucket=self.bucket_name,
                Prefix='backups/'
            )
            
            if 'Contents' not in response:
                return {
                    'total_backups': 0,
                    'total_size_mb': 0,
                    'oldest_backup': None,
                    'newest_backup': None
                }
            
            objects = response['Contents']
            total_size = sum(obj['Size'] for obj in objects)
            dates = [obj['LastModified'] for obj in objects]
            
            return {
                'total_backups': len(objects),
                'total_size_mb': round(total_size / (1024 * 1024), 2),
                'total_size_gb': round(total_size / (1024 * 1024 * 1024), 3),
                'oldest_backup': min(dates) if dates else None,
                'newest_backup': max(dates) if dates else None
            }
            
        except ClientError as e:
            print(f"Error getting backup stats: {str(e)}")
            return {
                'total_backups': 0,
                'total_size_mb': 0,
                'error': str(e)
            }
    
    def compress_file(self, input_path: str, output_path: str) -> Tuple[bool, Optional[str]]:
        """
        Compress a file using gzip
        
        Args:
            input_path: Path to input file
            output_path: Path to output .gz file
            
        Returns:
            Tuple of (success, error_message)
        """
        try:
            with open(input_path, 'rb') as f_in:
                with gzip.open(output_path, 'wb', compresslevel=6) as f_out:
                    f_out.writelines(f_in)
            return True, None
        except Exception as e:
            return False, f"Compression failed: {str(e)}"
    
    def decompress_file(self, input_path: str, output_path: str) -> Tuple[bool, Optional[str]]:
        """
        Decompress a gzip file
        
        Args:
            input_path: Path to .gz file
            output_path: Path to output file
            
        Returns:
            Tuple of (success, error_message)
        """
        try:
            with gzip.open(input_path, 'rb') as f_in:
                with open(output_path, 'wb') as f_out:
                    f_out.writelines(f_in)
            return True, None
        except Exception as e:
            return False, f"Decompression failed: {str(e)}"
