"""
Django Management Command: backup_all
Automated backup of all tenant databases to AWS S3
"""
import os
import gzip
import tempfile
from datetime import datetime
from pathlib import Path
from django.core.management.base import BaseCommand, CommandError
from django.conf import settings
from sites.models import WordPressSite
from sites.tenant_db_manager import TenantDatabaseManager
from core.s3_backup_manager import S3BackupManager


class Command(BaseCommand):
    help = 'Backup all tenant databases to AWS S3 with compression and encryption'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--site',
            type=str,
            help='Backup only a specific site (by name)',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be backed up without actually doing it',
        )
        parser.add_argument(
            '--cleanup-only',
            action='store_true',
            help='Only clean up old backups, do not create new ones',
        )
        parser.add_argument(
            '--skip-cleanup',
            action='store_true',
            help='Skip cleanup of old backups',
        )
    
    def handle(self, *args, **options):
        """Execute backup operation"""
        self.stdout.write(self.style.SUCCESS('\n' + '='*70))
        self.stdout.write(self.style.SUCCESS('  AWS S3 Disaster Recovery Backup'))
        self.stdout.write(self.style.SUCCESS('='*70 + '\n'))
        
        # Initialize managers
        try:
            s3_manager = S3BackupManager()
            db_manager = TenantDatabaseManager()
        except Exception as e:
            raise CommandError(f'Failed to initialize managers: {str(e)}')
        
        # Verify AWS credentials
        self.stdout.write('Verifying AWS credentials...')
        success, error = s3_manager.verify_credentials()
        if not success:
            raise CommandError(f'AWS credentials verification failed: {error}')
        self.stdout.write(self.style.SUCCESS('✓ AWS credentials verified\n'))
        
        # Cleanup old backups if requested
        if options['cleanup_only']:
            self._cleanup_old_backups(s3_manager)
            return
        
        # Get sites to backup
        if options['site']:
            sites = WordPressSite.objects.filter(name=options['site'])
            if not sites.exists():
                raise CommandError(f"Site '{options['site']}' not found")
        else:
            sites = WordPressSite.objects.filter(db_container_name__isnull=False)
        
        if not sites.exists():
            self.stdout.write(self.style.WARNING('No sites with tenant databases found'))
            return
        
        self.stdout.write(f'Found {sites.count()} site(s) to backup\n')
        
        # Backup statistics
        stats = {
            'total': sites.count(),
            'success': 0,
            'failed': 0,
            'skipped': 0,
            'total_size_mb': 0
        }
        
        # Backup each site
        for site in sites:
            self.stdout.write(f'\n[{site.name}] Starting backup...')
            
            if options['dry_run']:
                self.stdout.write(self.style.WARNING(f'  [DRY RUN] Would backup {site.name}'))
                stats['skipped'] += 1
                continue
            
            success, size_mb, error = self._backup_site(site, db_manager, s3_manager)
            
            if success:
                stats['success'] += 1
                stats['total_size_mb'] += size_mb
                self.stdout.write(self.style.SUCCESS(f'  ✓ Backup completed ({size_mb:.2f} MB)'))
            else:
                stats['failed'] += 1
                self.stdout.write(self.style.ERROR(f'  ✗ Backup failed: {error}'))
        
        # Cleanup old backups
        if not options['skip_cleanup'] and not options['dry_run']:
            self.stdout.write('\n' + '-'*70)
            self._cleanup_old_backups(s3_manager)
        
        # Print summary
        self._print_summary(stats, s3_manager)
    
    def _backup_site(
        self, 
        site: WordPressSite, 
        db_manager: TenantDatabaseManager,
        s3_manager: S3BackupManager
    ) -> tuple:
        """
        Backup a single site's database
        
        Returns:
            Tuple of (success, size_mb, error_message)
        """
        temp_sql_file = None
        temp_gz_file = None
        
        try:
            # Step 1: Create mysqldump
            self.stdout.write(f'  → Creating database dump...')
            success, dump_path, error = db_manager.snapshot_tenant_database(
                site.name,
                site.db_root_password
            )
            
            if not success:
                return False, 0, f'mysqldump failed: {error}'
            
            temp_sql_file = dump_path
            
            # Step 2: Compress with gzip
            self.stdout.write(f'  → Compressing backup...')
            temp_gz_file = dump_path + '.gz'
            
            with open(dump_path, 'rb') as f_in:
                with gzip.open(temp_gz_file, 'wb', compresslevel=6) as f_out:
                    f_out.writelines(f_in)
            
            # Get compressed file size
            size_mb = os.path.getsize(temp_gz_file) / (1024 * 1024)
            
            # Step 3: Upload to S3
            self.stdout.write(f'  → Uploading to S3...')
            success, s3_key, error = s3_manager.upload_backup(
                temp_gz_file,
                site.name,
                backup_type='tenant'
            )
            
            if not success:
                return False, 0, f'S3 upload failed: {error}'
            
            self.stdout.write(f'  → S3 Key: {s3_key}')
            
            return True, size_mb, None
            
        except Exception as e:
            return False, 0, f'Unexpected error: {str(e)}'
            
        finally:
            # Cleanup temporary files
            if temp_sql_file and os.path.exists(temp_sql_file):
                os.remove(temp_sql_file)
            if temp_gz_file and os.path.exists(temp_gz_file):
                os.remove(temp_gz_file)
    
    def _cleanup_old_backups(self, s3_manager: S3BackupManager):
        """Clean up old backups from S3"""
        self.stdout.write('\nCleaning up old backups...')
        retention_days = settings.S3_BACKUP_RETENTION_DAYS
        
        count, deleted_keys = s3_manager.delete_old_backups(retention_days)
        
        if count > 0:
            self.stdout.write(self.style.SUCCESS(f'✓ Deleted {count} old backup(s) (>{retention_days} days)'))
            for key in deleted_keys:
                self.stdout.write(f'  - {key}')
        else:
            self.stdout.write('  No old backups to delete')
    
    def _print_summary(self, stats: dict, s3_manager: S3BackupManager):
        """Print backup summary"""
        self.stdout.write('\n' + '='*70)
        self.stdout.write(self.style.SUCCESS('  Backup Summary'))
        self.stdout.write('='*70)
        
        self.stdout.write(f'\nTotal sites:     {stats["total"]}')
        self.stdout.write(self.style.SUCCESS(f'Successful:      {stats["success"]}'))
        
        if stats['failed'] > 0:
            self.stdout.write(self.style.ERROR(f'Failed:          {stats["failed"]}'))
        
        if stats['skipped'] > 0:
            self.stdout.write(self.style.WARNING(f'Skipped:         {stats["skipped"]}'))
        
        self.stdout.write(f'Total uploaded:  {stats["total_size_mb"]:.2f} MB')
        
        # Get S3 statistics
        s3_stats = s3_manager.get_backup_stats()
        self.stdout.write(f'\nS3 Bucket Stats:')
        self.stdout.write(f'  Total backups: {s3_stats["total_backups"]}')
        self.stdout.write(f'  Total size:    {s3_stats["total_size_gb"]:.3f} GB ({s3_stats["total_size_mb"]:.2f} MB)')
        
        if s3_stats.get('newest_backup'):
            self.stdout.write(f'  Newest:        {s3_stats["newest_backup"].strftime("%Y-%m-%d %H:%M:%S")}')
        if s3_stats.get('oldest_backup'):
            self.stdout.write(f'  Oldest:        {s3_stats["oldest_backup"].strftime("%Y-%m-%d %H:%M:%S")}')
        
        # Free tier warning
        if s3_stats["total_size_gb"] > 4.5:
            self.stdout.write(self.style.WARNING('\n⚠ Warning: Approaching AWS Free Tier limit (5 GB)'))
        
        self.stdout.write('\n' + '='*70 + '\n')
