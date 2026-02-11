"""
Management command to sync FileBrowser users for sites without credentials
This can be run periodically as a cron job or manually when needed
"""
from django.core.management.base import BaseCommand
from sites.models import WordPressSite
from sites.filebrowser_manager import FileBrowserManager
import subprocess


class Command(BaseCommand):
    help = 'Create FileBrowser users for sites that don\'t have credentials yet'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--site',
            type=str,
            help='Specific site name to process (optional)',
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Force recreate credentials even if they exist',
        )
    
    def handle(self, *args, **options):
        fb_manager = FileBrowserManager()
        
        # Check if FileBrowser container is running
        if not fb_manager.container_running():
            self.stdout.write(self.style.ERROR('❌ FileBrowser container is not running!'))
            self.stdout.write('Please start it with: cd backend/filebrowser && docker-compose up -d')
            return
        
        # Get sites to process
        if options['site']:
            sites = WordPressSite.objects.filter(name=options['site'])
            if not sites.exists():
                self.stdout.write(self.style.ERROR(f'❌ Site "{options["site"]}" not found'))
                return
        else:
            # Get all sites without credentials
            sites = WordPressSite.objects.filter(
                filebrowser_username__isnull=True
            ) | WordPressSite.objects.filter(
                filebrowser_username=''
            )
        
        if not sites.exists():
            self.stdout.write(self.style.SUCCESS('✅ All sites already have FileBrowser credentials!'))
            return
        
        self.stdout.write(f'\nProcessing {sites.count()} site(s)...\n')
        
        # Stop FileBrowser to allow CLI access
        self.stdout.write('Stopping FileBrowser container...')
        subprocess.run(
            ['docker-compose', 'down'],
            cwd='/home/adarsha/Desktop/projects/HOST/host/backend/filebrowser',
            capture_output=True
        )
        
        success_count = 0
        error_count = 0
        
        for site in sites:
            try:
                # Generate credentials
                credentials = fb_manager.generate_credentials(site.name)
                
                # Create user via docker-compose run
                result = subprocess.run(
                    [
                        'docker-compose', 'run', '--rm', 'filebrowser',
                        'users', 'add', credentials['username'], credentials['password'],
                        '--scope', f'/{site.name}'
                    ],
                    cwd='/home/adarsha/Desktop/projects/HOST/host/backend/filebrowser',
                    capture_output=True,
                    text=True,
                    timeout=10
                )
                
                if result.returncode == 0:
                    # Save credentials to database
                    site.filebrowser_username = credentials['username']
                    site.filebrowser_password = credentials['password']
                    site.save()
                    
                    self.stdout.write(self.style.SUCCESS(
                        f'✅ {site.name}: Created user {credentials["username"]}'
                    ))
                    success_count += 1
                else:
                    error_msg = result.stderr or result.stdout
                    self.stdout.write(self.style.ERROR(
                        f'❌ {site.name}: Failed - {error_msg}'
                    ))
                    error_count += 1
                    
            except Exception as e:
                self.stdout.write(self.style.ERROR(
                    f'❌ {site.name}: Error - {str(e)}'
                ))
                error_count += 1
        
        # Restart FileBrowser
        self.stdout.write('\nRestarting FileBrowser container...')
        subprocess.run(
            ['docker-compose', 'up', '-d'],
            cwd='/home/adarsha/Desktop/projects/HOST/host/backend/filebrowser',
            capture_output=True
        )
        
        # Summary
        self.stdout.write('\n' + '='*50)
        self.stdout.write(self.style.SUCCESS(f'✅ Successfully created: {success_count}'))
        if error_count > 0:
            self.stdout.write(self.style.ERROR(f'❌ Failed: {error_count}'))
        self.stdout.write('='*50 + '\n')
