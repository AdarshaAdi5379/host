"""
Django Management Command: sync_containers
Syncs DB status with actual Docker container state.
Restarts containers for any site marked 'running' but not actually running.
"""
import subprocess
from django.core.management.base import BaseCommand
from sites.models import WordPressSite


def get_running_containers():
    """Return a set of container names that are currently running."""
    try:
        result = subprocess.run(
            ['docker', 'ps', '--format', '{{.Names}}'],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode == 0:
            return set(line.strip() for line in result.stdout.splitlines() if line.strip())
    except Exception:
        pass
    return set()


def start_site_containers(site_directory):
    """Start containers for a specific site directory."""
    try:
        result = subprocess.run(
            ['docker', 'compose', 'up', '-d'],
            cwd=site_directory,
            capture_output=True, text=True, timeout=120
        )
        return result.returncode == 0, result.stderr
    except subprocess.TimeoutExpired:
        return False, "Timed out"
    except Exception as e:
        return False, str(e)


class Command(BaseCommand):
    help = 'Sync DB container status with actual Docker state, and restart stopped containers'

    def add_arguments(self, parser):
        parser.add_argument(
            '--restart-stopped',
            action='store_true',
            default=True,
            help='Restart containers that should be running but are stopped (default: True)',
        )
        parser.add_argument(
            '--fix-db-status',
            action='store_true',
            default=True,
            help='Update DB status to match actual container state (default: True)',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be done without making changes',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        restart_stopped = options['restart_stopped']
        fix_db_status = options['fix_db_status']

        self.stdout.write(self.style.SUCCESS('\n' + '='*60))
        self.stdout.write(self.style.SUCCESS('  WordPress Container Sync'))
        self.stdout.write(self.style.SUCCESS('='*60 + '\n'))

        if dry_run:
            self.stdout.write(self.style.WARNING('[DRY RUN MODE - No changes will be made]\n'))

        # Get all currently running containers
        running_containers = get_running_containers()
        self.stdout.write(f'Running containers: {len(running_containers)}\n')

        sites = WordPressSite.objects.exclude(site_directory='').exclude(site_directory__isnull=True)
        self.stdout.write(f'Tracked sites in DB: {sites.count()}\n')

        stats = {'started': 0, 'already_running': 0, 'failed': 0, 'db_fixed': 0}

        for site in sites:
            container_name = f'{site.name}_wp'
            is_running = container_name in running_containers

            self.stdout.write(f'\n  Site: {site.name}')
            self.stdout.write(f'    DB Status:  {site.status}')
            self.stdout.write(f'    Container:  {"✓ running" if is_running else "✗ stopped/missing"}')

            if is_running:
                stats['already_running'] += 1
                # Fix DB status if it says something other than 'running'
                if site.status != 'running' and fix_db_status:
                    if not dry_run:
                        site.status = 'running'
                        site.save()
                        stats['db_fixed'] += 1
                        self.stdout.write(self.style.SUCCESS(f'    → Fixed DB status: {site.status} → running'))
                    else:
                        self.stdout.write(self.style.WARNING(f'    → [DRY RUN] Would fix DB status to running'))

            else:
                # Container is not running
                if site.status == 'running' and restart_stopped:
                    self.stdout.write(f'    → Starting containers...')
                    if not dry_run:
                        success, error = start_site_containers(site.site_directory)
                        if success:
                            stats['started'] += 1
                            self.stdout.write(self.style.SUCCESS(f'    ✓ Started successfully'))
                        else:
                            stats['failed'] += 1
                            self.stdout.write(self.style.ERROR(f'    ✗ Failed: {error[:100]}'))
                            # Fix DB status to reflect reality
                            if fix_db_status:
                                site.status = 'stopped'
                                site.save()
                                stats['db_fixed'] += 1
                    else:
                        self.stdout.write(self.style.WARNING(f'    → [DRY RUN] Would start containers'))

                elif fix_db_status and site.status == 'running':
                    # status says running but container is not, and restart is disabled
                    if not dry_run:
                        site.status = 'stopped'
                        site.save()
                        stats['db_fixed'] += 1
                        self.stdout.write(self.style.WARNING(f'    → Fixed DB status to: stopped'))
                    else:
                        self.stdout.write(self.style.WARNING(f'    → [DRY RUN] Would fix DB status to stopped'))

        # Print summary
        self.stdout.write('\n' + '='*60)
        self.stdout.write(self.style.SUCCESS('  Summary'))
        self.stdout.write('='*60)
        self.stdout.write(f'\n  Already running:  {stats["already_running"]}')
        self.stdout.write(self.style.SUCCESS(f'  Started:          {stats["started"]}'))
        if stats['failed'] > 0:
            self.stdout.write(self.style.ERROR(f'  Failed to start:  {stats["failed"]}'))
        if stats['db_fixed'] > 0:
            self.stdout.write(self.style.WARNING(f'  DB status fixed:  {stats["db_fixed"]}'))
        self.stdout.write('\n' + '='*60 + '\n')
