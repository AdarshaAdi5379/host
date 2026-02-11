"""
Management command to generate FileBrowser credentials for existing sites
"""
from django.core.management.base import BaseCommand
from sites.models import WordPressSite
from sites.filebrowser_manager import FileBrowserManager


class Command(BaseCommand):
    help = 'Generate FileBrowser credentials for existing WordPress sites'

    def add_arguments(self, parser):
        parser.add_argument(
            '--site',
            type=str,
            help='Generate credentials for a specific site (by name)',
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Regenerate credentials even if they already exist',
        )

    def handle(self, *args, **options):
        site_name = options.get('site')
        force = options.get('force', False)
        
        # Get sites to process
        if site_name:
            sites = WordPressSite.objects.filter(name=site_name)
            if not sites.exists():
                self.stdout.write(self.style.ERROR(f'Site "{site_name}" not found'))
                return
        else:
            sites = WordPressSite.objects.all()
        
        fb_manager = FileBrowserManager()
        
        # Check if FileBrowser container is running
        if not fb_manager.container_running():
            self.stdout.write(self.style.ERROR(
                'FileBrowser container is not running. Please start it first.'
            ))
            return
        
        total = sites.count()
        created = 0
        skipped = 0
        errors = 0
        
        self.stdout.write(f'Processing {total} site(s)...\n')
        
        for site in sites:
            # Skip if credentials already exist and not forcing
            if site.filebrowser_username and site.filebrowser_password and not force:
                self.stdout.write(f'  ⏭️  {site.name}: Already has credentials (use --force to regenerate)')
                skipped += 1
                continue
            
            # Delete existing user if forcing regeneration
            if force and site.filebrowser_username:
                self.stdout.write(f'  🗑️  {site.name}: Deleting existing user...')
                fb_manager.delete_user(site.filebrowser_username)
            
            # Generate new credentials
            credentials = fb_manager.generate_credentials(site.name)
            
            # Create FileBrowser user
            result = fb_manager.create_user(
                site_name=site.name,
                username=credentials['username'],
                password=credentials['password']
            )
            
            if result['success']:
                # Save to database
                site.filebrowser_username = credentials['username']
                site.filebrowser_password = credentials['password']
                site.save()
                
                self.stdout.write(self.style.SUCCESS(
                    f'  ✅ {site.name}: Created user "{credentials["username"]}"'
                ))
                created += 1
            else:
                self.stdout.write(self.style.ERROR(
                    f'  ❌ {site.name}: Failed - {result.get("error")}'
                ))
                errors += 1
        
        # Summary
        self.stdout.write('\n' + '='*50)
        self.stdout.write(f'Total sites processed: {total}')
        self.stdout.write(self.style.SUCCESS(f'Successfully created: {created}'))
        if skipped > 0:
            self.stdout.write(f'Skipped (already exists): {skipped}')
        if errors > 0:
            self.stdout.write(self.style.ERROR(f'Errors: {errors}'))
