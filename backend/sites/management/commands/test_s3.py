"""
Django management command to test AWS S3 connection
"""
from django.core.management.base import BaseCommand
from core.s3_backup_manager import S3BackupManager


class Command(BaseCommand):
    help = 'Test AWS S3 connection and credentials'

    def handle(self, *args, **options):
        """Test S3 connection"""
        self.stdout.write("\n" + "="*60)
        self.stdout.write(self.style.HTTP_INFO("  AWS S3 Connection Test"))
        self.stdout.write("="*60 + "\n")
        
        try:
            # Initialize S3 manager
            self.stdout.write("📦 Initializing S3 Backup Manager...")
            s3_manager = S3BackupManager()
            
            # Display configuration
            self.stdout.write("\n" + "-"*60)
            self.stdout.write(self.style.HTTP_INFO("Configuration:"))
            self.stdout.write("-"*60)
            self.stdout.write(f"  Bucket Name: {s3_manager.bucket_name}")
            self.stdout.write(f"  Region: {s3_manager.region}")
            self.stdout.write(f"  Retention Days: {s3_manager.retention_days}")
            
            # Test credentials
            self.stdout.write("\n" + "-"*60)
            self.stdout.write(self.style.HTTP_INFO("Testing Credentials:"))
            self.stdout.write("-"*60)
            self.stdout.write("🔐 Verifying AWS credentials and bucket access...")
            
            success, error = s3_manager.verify_credentials()
            
            if success:
                self.stdout.write(self.style.SUCCESS("\n✅ SUCCESS: AWS S3 connection verified!"))
                self.stdout.write(self.style.SUCCESS(f"✅ Bucket '{s3_manager.bucket_name}' is accessible"))
                
                # Get backup statistics
                self.stdout.write("\n" + "-"*60)
                self.stdout.write(self.style.HTTP_INFO("Backup Statistics:"))
                self.stdout.write("-"*60)
                stats = s3_manager.get_backup_stats()
                
                if 'error' in stats:
                    self.stdout.write(self.style.WARNING(f"⚠️  Could not retrieve stats: {stats['error']}"))
                else:
                    self.stdout.write(f"  Total Backups: {stats['total_backups']}")
                    if stats.get('total_size_gb'):
                        self.stdout.write(f"  Total Size: {stats['total_size_mb']} MB ({stats['total_size_gb']} GB)")
                    else:
                        self.stdout.write(f"  Total Size: {stats['total_size_mb']} MB")
                    if stats.get('oldest_backup'):
                        self.stdout.write(f"  Oldest Backup: {stats['oldest_backup']}")
                    if stats.get('newest_backup'):
                        self.stdout.write(f"  Newest Backup: {stats['newest_backup']}")
                    
                    if stats['total_backups'] == 0:
                        self.stdout.write(self.style.WARNING("\n⚠️  No backups found in S3 bucket yet"))
                        self.stdout.write("   Run 'python manage.py backup_all' to create your first backup")
                
                self.stdout.write("\n" + "="*60)
                self.stdout.write(self.style.SUCCESS("🎉 All tests passed! Your S3 configuration is working."))
                self.stdout.write("="*60 + "\n")
                
            else:
                self.stdout.write(self.style.ERROR(f"\n❌ FAILED: {error}"))
                self.stdout.write("\n" + "-"*60)
                self.stdout.write(self.style.ERROR("Troubleshooting Tips:"))
                self.stdout.write("-"*60)
                
                if "not found" in error.lower():
                    self.stdout.write("  1. Verify the bucket name in your .env file")
                    self.stdout.write("  2. Check that the bucket exists in AWS S3 console")
                    self.stdout.write(f"  3. Ensure bucket is in region: {s3_manager.region}")
                elif "access denied" in error.lower() or "403" in error:
                    self.stdout.write("  1. Check IAM user permissions")
                    self.stdout.write("  2. Ensure the IAM user has s3:ListBucket permission")
                    self.stdout.write("  3. Verify bucket policy allows access")
                elif "credentials" in error.lower():
                    self.stdout.write("  1. Verify AWS_ACCESS_KEY_ID in .env file")
                    self.stdout.write("  2. Verify AWS_SECRET_ACCESS_KEY in .env file")
                    self.stdout.write("  3. Check that credentials are active in AWS IAM")
                else:
                    self.stdout.write("  1. Check your internet connection")
                    self.stdout.write("  2. Verify all AWS credentials in .env file")
                    self.stdout.write("  3. Check AWS service status")
                
                self.stdout.write("\n" + "="*60 + "\n")
                return
                
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"\n❌ Unexpected error: {str(e)}"))
            self.stdout.write(self.style.ERROR("\nPlease check your .env configuration and try again."))
            self.stdout.write("\n" + "="*60 + "\n")
