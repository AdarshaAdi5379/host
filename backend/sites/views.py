from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.conf import settings as django_settings
from django.contrib.auth.models import User
from django.db.models import Q
import secrets
import string
import time
import psutil
import docker

from .models import WordPressSite, CustomDomain, ProjectMembership, AuditLog, UserProfile
from .serializers import (
    WordPressSiteSerializer, WordPressSiteCreateSerializer, CustomDomainSerializer,
    ProjectMembershipSerializer, InviteMemberSerializer, AuditLogSerializer,
    UserProfileSerializer, ServerStatsSerializer, UserSerializer
)
from .permissions import (
    IsSuperAdmin, IsSiteOwner, IsProjectMember, CanManageTeam,
    CanDeleteProject, CanStartStopContainer, HasProjectQuota
)
from .audit_logger import AuditLogger
from .orchestrator import (
    find_available_port,
    generate_docker_compose,
    write_docker_compose,
    create_site_directory,
    generate_nginx_config,
    generate_wp_config_content,
    write_wp_config
)
from .docker_utils import (
    run_docker_compose_up,
    run_docker_compose_down,
    run_docker_compose_down_volumes,
    check_docker_running
)



class WordPressSiteViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing WordPress sites
    """
    queryset = WordPressSite.objects.all()
    serializer_class = WordPressSiteSerializer
    
    def get_queryset(self):
        """
        Multi-Tenant Filtering:
        - Superusers/Staff: See ALL sites
        - Regular Users: See ONLY their own sites
        """
        user = self.request.user
        if user.is_staff or user.is_superuser:
            return WordPressSite.objects.all()
        # Regular users only see what they own
        if user.is_authenticated:
            return WordPressSite.objects.filter(owner=user)
        return WordPressSite.objects.none()

    def perform_create(self, serializer):
        """Assign current user as owner when creating site"""
        serializer.save(owner=self.request.user)
    
    def get_serializer_class(self):
        if self.action == 'create':
            return WordPressSiteCreateSerializer
        return WordPressSiteSerializer
    
    def create(self, request):
        """
        Create a new WordPress site instance
        """
        serializer = WordPressSiteCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        site_name = serializer.validated_data['name']
        admin_username = serializer.validated_data['admin_username']
        admin_password = serializer.validated_data['admin_password']
        
        try:
            # Step 1: Provision isolated MySQL database container
            from .tenant_db_manager import TenantDatabaseManager
            
            db_manager = TenantDatabaseManager()
            
            # VPC ARCHITECTURE CHANGE: 
            # We no longer create the DB container here. 
            # Instead, we generate credentials and let docker-compose handle the DB lifecycle.
            db_config = db_manager.generate_credentials(site_name)
            
            # Legacy compatibility (variables used later)
            db_success = True
            db_error = None
            
            # Step 2: Generate configuration
            port = find_available_port()
            domain = f"{site_name}.local"
            
            # Step 3: Create site directory
            site_dir = create_site_directory(site_name)
            
            # Step 4: Generate and write wp-config.php with tenant DB credentials
            wp_config_content = generate_wp_config_content(
                db_host=f"{db_config['db_host']}:3306",
                db_name=db_config['db_name'],
                db_user=db_config['db_user'],
                db_password=db_config['db_password']
            )
            write_wp_config(site_dir, wp_config_content)
            
            # Step 5: Generate and write docker-compose.yml
            compose_config = generate_docker_compose(site_name, db_config, port)
            compose_path = write_docker_compose(site_dir, compose_config)
            
            # Step 6: Create database record with tenant DB credentials
            site = WordPressSite.objects.create(
                name=site_name,
                domain=domain,
                port=port,
                admin_username=admin_username,
                admin_password=admin_password,  # In production, hash this
                site_directory=site_dir,
                docker_compose_path=compose_path,
                status='provisioning',
                owner=request.user,  # Assign owner for multi-tenancy
                # Tenant database credentials
                db_container_name=db_config['container_name'],
                db_container_id=db_config.get('container_id'), # Use .get() as it may be None in VPC mode
                db_host=db_config['db_host'],
                db_name=db_config['db_name'],
                db_user=db_config['db_user'],
                db_password=db_config['db_password'],
                db_root_password=db_config['root_password']
            )
            
            # Step 6.5: Create FileBrowser user for multi-tenant file access
            from .filebrowser_manager import FileBrowserManager
            
            fb_manager = FileBrowserManager()
            fb_credentials = fb_manager.generate_credentials(site_name)
            
            # Create scoped FileBrowser user
            fb_result = fb_manager.create_user(
                site_name=site_name,
                username=fb_credentials['username'],
                password=fb_credentials['password']
            )
            
            if fb_result['success']:
                # Save credentials to database
                site.filebrowser_username = fb_credentials['username']
                site.filebrowser_password = fb_credentials['password']
                site.save()
            else:
                # Log warning but don't fail site creation
                print(f"Warning: Failed to create FileBrowser user: {fb_result.get('error')}")
            
            # Start Docker containers
            success, output = run_docker_compose_up(site_dir)
            
            if success:
                # FIX: Bind mounts for individual files are flaky on Windows Docker Desktop
                # We manually copy the config file and restart the container
                import subprocess
                
                # Copy wp-config.php
                from pathlib import Path
                container_name = f"{site_name}_wp"
                config_src = str(Path(site_dir) / 'wp-config.php')
                # Escape path for Windows shell if needed, but subprocess handles list args well usually.
                # However, for docker cp, it sometimes needs care.
                
                cp_cmd = ['docker', 'cp', config_src, f'{container_name}:/var/www/html/wp-config.php']
                cp_result = subprocess.run(cp_cmd, capture_output=True, text=True)
                
                if cp_result.returncode == 0:
                    # Restart container to apply config
                    subprocess.run(['docker', 'restart', container_name], capture_output=True)
                else:
                    print(f"Warning: Failed to copy wp-config.php: {cp_result.stderr}")

                site.status = 'running'
                
                # VPC ARCHITECTURE: Fetch and save DB Container ID
                # Since docker-compose started the DB, we need to look it up now
                try:
                    import docker
                    client = docker.from_env()
                    db_container_name = db_config['container_name']
                    container = client.containers.get(db_container_name)
                    site.db_container_id = container.id
                    site.save()
                except Exception as e:
                    print(f"Warning: Failed to fetch DB container ID for {db_container_name}: {e}")
                
                site.save()

                # Steps 7 & 8: Run WP setup + S3 config + backup in background
                # This makes the API return immediately after containers start (~5-10s)
                import threading
                import subprocess as _subprocess
                import gzip
                import os as _os

                # Capture all needed values before the thread starts
                _container_name = container_name
                _site_name = site_name
                _port = port
                _admin_user = request.data.get('admin_username', 'admin')
                _admin_email = request.data.get('admin_email', 'admin@example.com')
                _admin_password = request.data.get('admin_password', 'password')
                _db_config = db_config
                _s3_endpoint = 'http://host.docker.internal:9300'
                _s3_bucket = django_settings.AWS_STORAGE_BUCKET_NAME
                _s3_key = django_settings.AWS_ACCESS_KEY_ID
                _s3_secret = django_settings.AWS_SECRET_ACCESS_KEY

                def setup_wordpress_background():
                    """Background task: wait for DB, install WP, configure S3, backup."""
                    # --- Step 7a: Wait for DB ---
                    print(f"[BG] Waiting for DB for {_site_name}...")
                    max_attempts = 30
                    for i in range(max_attempts):
                        time.sleep(3)
                        db_check = _subprocess.run([
                            'docker', 'exec', _container_name,
                            'wp', 'db', 'check', '--allow-root'
                        ], capture_output=True)
                        if db_check.returncode == 0:
                            print(f"[BG] ✅ Database ready after {(i+1)*3}s")
                            break
                        print(f"[BG] Waiting for DB... ({i+1}/{max_attempts})")
                    else:
                        print(f"[BG] ❌ DB never became ready for {_site_name}. Aborting setup.")
                        return

                    # --- Step 7b: WP Core Install (with correct port URL) ---
                    # Use the actual host port so WordPress stores the right siteurl
                    wp_url = f"http://localhost:{_port}"
                    print(f"[BG] Installing WordPress Core for {_site_name} at {wp_url}...")
                    core_install = _subprocess.run([
                        'docker', 'exec', _container_name,
                        'wp', 'core', 'install',
                        f'--url={wp_url}',
                        f'--title={_site_name}',
                        f'--admin_user={_admin_user}',
                        f'--admin_password={_admin_password}',
                        f'--admin_email={_admin_email}',
                        '--skip-email',
                        '--allow-root'
                    ], capture_output=True, text=True)

                    if core_install.returncode != 0:
                        print(f"[BG] ❌ Core Install Failed: {core_install.stderr}")
                        return
                    print(f"[BG] ✅ Core Installed: {core_install.stdout.strip()}")

                    # --- Step 7c: Install & Activate Media Cloud plugin ---
                    plugin_cmd = (
                        "wp plugin install ilab-media-tools --activate --allow-root "
                        "> /tmp/wp_install.log 2>&1"
                    )
                    plugin_install = _subprocess.run([
                        'docker', 'exec', _container_name,
                        'sh', '-c', plugin_cmd
                    ], capture_output=True, text=True)

                    if plugin_install.returncode != 0:
                        log_out = _subprocess.run(
                            ['docker', 'exec', _container_name, 'cat', '/tmp/wp_install.log'],
                            capture_output=True, text=True
                        )
                        print(f"[BG] ❌ Plugin Install Failed: {log_out.stdout}")
                        return
                    print(f"[BG] ✅ Plugin Installed.")

                    time.sleep(2)  # Let plugin initialise DB tables

                    # --- Step 7d: Configure S3/MinIO via WP options ---
                    mcloud_settings = {
                        'mcloud-storage-provider': 's3',
                        'mcloud-storage-s3-endpoint': _s3_endpoint,
                        'mcloud-storage-s3-bucket': _s3_bucket,
                        'mcloud-storage-s3-access-key': _s3_key,
                        'mcloud-storage-s3-secret': _s3_secret,
                        'mcloud-storage-s3-region': 'us-east-1',
                        'mcloud-storage-s3-use-path-style-endpoint': '1',
                        'mcloud-storage-upload-images': '1',
                        'mcloud-storage-upload-audio': '1',
                        'mcloud-storage-upload-videos': '1',
                        'mcloud-storage-upload-documents': '1',
                        'mcloud-storage-delete-uploads': '1',
                    }
                    try:
                        for opt_key, opt_val in mcloud_settings.items():
                            _subprocess.run([
                                'docker', 'exec', _container_name,
                                'wp', 'option', 'update', opt_key, opt_val, '--allow-root'
                            ], check=True, capture_output=True)
                        _subprocess.run([
                            'docker', 'exec', _container_name,
                            'wp', 'cache', 'flush', '--allow-root'
                        ], check=True, capture_output=True)
                        print(f"[BG] ✅ S3 Offload configured for {_site_name}")
                    except _subprocess.CalledProcessError as e:
                        print(f"[BG] ❌ S3 Config Failed: {e}")

                    # --- Step 8: Auto S3 Backup ---
                    try:
                        from core.s3_backup_manager import S3BackupManager
                        from .tenant_db_manager import TenantDatabaseManager as _TDB
                        s3_manager = S3BackupManager()
                        db_mgr = _TDB()
                        ok, dump_path, err = db_mgr.snapshot_tenant_database(
                            _site_name, _db_config['root_password']
                        )
                        if ok and dump_path:
                            gz_path = dump_path + '.gz'
                            with open(dump_path, 'rb') as f_in:
                                with gzip.open(gz_path, 'wb', compresslevel=6) as f_out:
                                    f_out.writelines(f_in)
                            up_ok, up_key, up_err = s3_manager.upload_backup(
                                gz_path, _site_name, backup_type='tenant'
                            )
                            for p in (dump_path, gz_path):
                                if _os.path.exists(p):
                                    _os.remove(p)
                            if up_ok:
                                print(f"[BG] ✅ Auto-backup done: {up_key}")
                            else:
                                print(f"[BG] ✗ Auto-backup upload failed: {up_err}")
                        else:
                            print(f"[BG] ✗ Auto-backup dump failed: {err}")
                    except Exception as e:
                        print(f"[BG] ✗ Auto-backup error: {e}")

                # Launch background thread — API returns immediately
                bg_thread = threading.Thread(target=setup_wordpress_background, daemon=True)
                bg_thread.start()
                print(f"[BG] WordPress setup thread started for {site_name}")
                
            else:
                site.status = 'error'
                site.save()
                return Response(
                    {'error': f'Site created but failed to start containers: {output}'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
            
            # Return created site
            response_serializer = WordPressSiteSerializer(site)
            return Response(response_serializer.data, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            return Response(
                {'error': f'Failed to create site: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        """Start a WordPress site (docker-compose up)"""
        site = self.get_object()
        
        # Check if Docker is running
        if not check_docker_running():
            return Response(
                {'error': 'Docker is not running. Please start Docker Desktop.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        # Start containers
        success, output = run_docker_compose_up(site.site_directory)
        
        if success:
            site.status = 'running'
            site.save()
            

                
            return Response({'status': 'Site started successfully'})
        else:
            site.status = 'error'
            site.save()
            return Response(
                {'error': f'Failed to start site: {output}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['post'])
    def stop(self, request, pk=None):
        """Stop a WordPress site (docker-compose down)"""
        site = self.get_object()
        
        # Stop containers
        success, output = run_docker_compose_down(site.site_directory)
        
        if success:
            site.status = 'stopped'
            site.save()
            return Response({'status': 'Site stopped successfully'})
        else:
            return Response(
                {'error': f'Failed to stop site: {output}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['delete'])
    def terminate(self, request, pk=None):
        """Terminate and delete a WordPress site"""
        site = self.get_object()
        
        # Step 1: Stop and remove WordPress containers and volumes
        success, output = run_docker_compose_down_volumes(site.site_directory)
        
        if not success:
            # Fallback: Try to remove containers directly if docker-compose fails
            # This handles cases where docker-compose.yml has syntax errors
            import subprocess
            try:
                container_name = f"{site.name}_wp"
                # Force remove the container
                subprocess.run(['docker', 'rm', '-f', container_name], 
                             capture_output=True, check=False)
                # Remove the volume
                volume_name = f"{site.name}_wp_data"
                subprocess.run(['docker', 'volume', 'rm', '-f', volume_name], 
                             capture_output=True, check=False)
            except Exception as e:
                print(f"Warning: Direct container removal failed: {str(e)}")
        
        # Step 2: Remove tenant MySQL database container
        if site.db_container_name:
            from .tenant_db_manager import TenantDatabaseManager
            db_manager = TenantDatabaseManager()
            db_success, db_error = db_manager.remove_tenant_database(site.name, remove_volumes=True)
            
            if not db_success:
                # Log error but don't fail the entire operation
                print(f"Warning: Failed to remove tenant database: {db_error}")
        
        # Step 2.5: Remove FileBrowser user
        if site.filebrowser_username:
            from .filebrowser_manager import FileBrowserManager
            fb_manager = FileBrowserManager()
            fb_result = fb_manager.delete_user(site.filebrowser_username)
            
            if not fb_result['success']:
                # Log warning but don't fail deletion
                print(f"Warning: Failed to delete FileBrowser user: {fb_result.get('error')}")
        
        # Step 3: Delete site record
        site.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['get'])
    def stats(self, request, pk=None):
        """
        Get real-time statistics for the site's container
        """
        site = self.get_object()
        container_name = f"{site.name}_wp"
        
        # Import here to avoid circular dependency issues if any
        from .docker_utils import get_container_stats
        
        stats = get_container_stats(container_name)
        
        if stats:
            return Response(stats)
        else:
            # If stats are None, it might be offline or not found
            return Response({
                'status': 'offline',
                'cpu_percent': 0,
                'memory_usage_mb': 0,
                'memory_limit_mb': 0,
                'memory_percent': 0
            })
    
    @action(detail=True, methods=['get'])
    def filebrowser_credentials(self, request, pk=None):
        """
        Get FileBrowser credentials for this site
        Returns username, password, and URL for file manager access
        """
        from .serializers import FileBrowserCredentialsSerializer
        
        site = self.get_object()
        
        if not site.filebrowser_username or not site.filebrowser_password:
            return Response(
                {'error': 'FileBrowser credentials not configured for this site'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        credentials = {
            'username': site.filebrowser_username,
            'password': site.filebrowser_password,
            'url': 'https://files.edubricz.online'
        }
        
        serializer = FileBrowserCredentialsSerializer(credentials)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def enable_public_access(self, request, pk=None):
        """
        Enable public access for the site via Cloudflare Tunnel
        Returns: { "public_url": "https://mysite.edubricz.online" }
        """
        site = self.get_object()
        
        # Import ingress manager
        from .ingress_manager import IngressManager
        
        # Check if site is running
        if site.status != 'running':
            return Response(
                {'error': 'Site must be running before enabling public access'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if already enabled
        if site.public_access_enabled:
            return Response(
                {'error': 'Public access is already enabled', 'public_url': site.public_url},
                status=status.HTTP_409_CONFLICT
            )
        
        try:
            manager = IngressManager()
            
            # Generate subdomain from site name (lowercase, replace spaces with hyphens)
            subdomain = site.name.lower().replace(' ', '-').replace('_', '-')
            
            # Validate subdomain
            is_valid, error = manager.validate_subdomain(subdomain)
            if not is_valid:
                return Response(
                    {'error': f'Invalid subdomain: {error}'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Add route to tunnel
            success, public_url, error = manager.add_route(subdomain, site.port)
            
            if not success:
                return Response(
                    {'error': error},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
            
            # Update site record
            site.subdomain = subdomain
            site.public_url = public_url
            site.public_access_enabled = True
            site.save()
            
            return Response({
                'public_url': public_url,
                'subdomain': subdomain,
                'status': 'Public access enabled successfully'
            })
            
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        except Exception as e:
            return Response(
                {'error': f'Failed to enable public access: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['post'])
    def disable_public_access(self, request, pk=None):
        """
        Disable public access for the site
        Returns: { "status": "Public access disabled" }
        """
        site = self.get_object()
        
        # Import ingress manager
        from .ingress_manager import IngressManager
        
        # Check if public access is enabled
        if not site.public_access_enabled:
            return Response(
                {'error': 'Public access is not enabled'},
                status=status.HTTP_409_CONFLICT
            )
        
        try:
            manager = IngressManager()
            
            # Remove route from tunnel
            success, error = manager.remove_route(site.subdomain)
            
            if not success and error:
                return Response(
                    {'error': error},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
            
            # Update site record
            site.subdomain = None
            site.public_url = None
            site.public_access_enabled = False
            site.save()
            
            return Response({
                'status': 'Public access disabled successfully'
            })
            
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        except Exception as e:
            return Response(
                {'error': f'Failed to disable public access: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def aggregate_stats(self, request):
        """
        Get aggregated resource usage statistics from all running sites
        """
        from .docker_utils import get_container_stats
        
        # Get all running sites
        running_sites = WordPressSite.objects.filter(status='running')
        
        if not running_sites.exists():
            return Response({
                'cpu': 0,
                'ram': 0,
                'total_sites': 0,
                'running_sites': 0
            })
        
        total_cpu = 0
        total_ram_mb = 0
        sites_with_stats = 0
        
        for site in running_sites:
            container_name = f"{site.name}_wp"
            stats = get_container_stats(container_name)
            
            if stats and stats.get('status') != 'offline':
                total_cpu += stats.get('cpu_percent', 0)
                total_ram_mb += stats.get('memory_usage_mb', 0)
                sites_with_stats += 1
        
        return Response({
            'cpu': round(total_cpu, 2),
            'ram': round(total_ram_mb, 2),
            'total_sites': WordPressSite.objects.count(),
            'running_sites': running_sites.count(),
            'sites_with_stats': sites_with_stats
        })
    
    @action(detail=True, methods=['post'])
    def snapshot(self, request, pk=None):
        """
        Create a database backup snapshot for a specific site
        Returns: { "backup_file": "/path/to/backup.sql", "size_mb": 1.23 }
        """
        site = self.get_object()
        
        if not site.db_container_name:
            return Response(
                {'error': 'Site does not have a tenant database'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not site.db_root_password:
            return Response(
                {'error': 'Database root password not available'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            from .tenant_db_manager import TenantDatabaseManager
            db_manager = TenantDatabaseManager()
            
            success, backup_path, error = db_manager.snapshot_tenant_database(
                site.name,
                site.db_root_password
            )
            
            if not success:
                return Response(
                    {'error': error},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
            
            # Get backup file size
            from pathlib import Path
            backup_file = Path(backup_path)
            size_mb = round(backup_file.stat().st_size / (1024 * 1024), 2)
            
            return Response({
                'backup_file': backup_path,
                'size_mb': size_mb,
                'status': 'Backup created successfully'
            })
            
        except Exception as e:
            return Response(
                {'error': f'Failed to create backup: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['get'])
    def database(self, request, pk=None):
        """
        Get database credentials for a specific site
        Returns: Database connection details for use with Adminer
        """
        site = self.get_object()
        
        # Verify site has database credentials
        if not site.db_host or not site.db_password:
            return Response(
                {'error': 'Database credentials not available for this site'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Return database credentials
        return Response({
            'host': site.db_host,
            'database': site.db_name,
            'username': site.db_user,
            'password': site.db_password,
            'port': 3306,
            'adminer_url': 'https://db.edubricz.online',
            'container_name': site.db_container_name
        })
    
    @action(detail=True, methods=['get'])
    def file_manager(self, request, pk=None):
        """
        Get file manager access information for a site
        """
        site = self.get_object()
        
        # Calculate disk usage for the site
        import os
        site_path = os.path.join('/home/adarsha/Desktop/projects/HOST/host/backend/wordpress_sites', site.name)
        disk_used = 0
        
        try:
            if os.path.exists(site_path):
                for dirpath, dirnames, filenames in os.walk(site_path):
                    for filename in filenames:
                        filepath = os.path.join(dirpath, filename)
                        if os.path.exists(filepath):
                            disk_used += os.path.getsize(filepath)
        except Exception as e:
            print(f"Error calculating disk usage: {e}")
        
        return Response({
            'url': 'https://files.edubricz.online',
            'path': f'/srv/{site.name}',
            'site_name': site.name,
            'disk_usage': {
                'used': disk_used,
                'total': 10 * 1024 * 1024 * 1024,  # 10GB default
                'used_mb': round(disk_used / (1024 * 1024), 2),
                'used_gb': round(disk_used / (1024 * 1024 * 1024), 2)
            },
            # Include FileBrowser credentials if available
            'username': site.filebrowser_username if site.filebrowser_username else None,
            'password': site.filebrowser_password if site.filebrowser_password else None
        })
    
    @action(detail=True, methods=['post'])
    def connect_domain(self, request, pk=None):
        """
        Connect a custom domain to this WordPress site
        Creates a Cloudflare Zone and returns nameservers
        """
        from .models import CustomDomain
        from .serializers import ConnectDomainSerializer, CustomDomainSerializer
        from .cloudflare_manager import CloudflareZoneManager
        
        site = self.get_object()
        serializer = ConnectDomainSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        domain_name = serializer.validated_data['domain_name']
        
        try:
            # Initialize Cloudflare manager
            cf_manager = CloudflareZoneManager()
            
            # Create zone in Cloudflare
            result = cf_manager.create_zone(domain_name)
            
            if not result['success']:
                return Response(
                    {'error': result.get('error', 'Failed to create Cloudflare zone')},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Create CustomDomain record
            custom_domain = CustomDomain.objects.create(
                site=site,
                domain_name=domain_name,
                cloudflare_zone_id=result['zone_id'],
                nameservers=result['nameservers'],
                status='pending'
            )
            
            # Return domain details
            domain_serializer = CustomDomainSerializer(custom_domain)
            return Response(domain_serializer.data, status=status.HTTP_201_CREATED)
        
        except ValueError as e:
            # Missing Cloudflare credentials
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        except Exception as e:
            return Response(
                {'error': f'Unexpected error: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['get'])
    def domains(self, request, pk=None):
        """
        List all custom domains connected to this site
        """
        from .models import CustomDomain
        from .serializers import CustomDomainSerializer
        
        site = self.get_object()
        domains = CustomDomain.objects.filter(site=site)
        serializer = CustomDomainSerializer(domains, many=True)
        
        return Response(serializer.data)
    
    @action(detail=True, methods=['delete'], url_path='domains/(?P<domain_id>[^/.]+)')
    def remove_domain(self, request, pk=None, domain_id=None):
        """
        Remove a custom domain and delete the Cloudflare zone
        """
        from .models import CustomDomain
        from .cloudflare_manager import CloudflareZoneManager
        
        site = self.get_object()
        
        try:
            domain = CustomDomain.objects.get(id=domain_id, site=site)
        except CustomDomain.DoesNotExist:
            return Response(
                {'error': 'Domain not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Delete Cloudflare zone if it exists
        if domain.cloudflare_zone_id:
            try:
                cf_manager = CloudflareZoneManager()
                cf_manager.delete_zone(domain.cloudflare_zone_id)
            except Exception as e:
                # Log error but continue with database deletion
                print(f"Failed to delete Cloudflare zone: {e}")
        
        # Delete from database
        domain.delete()
        
        return Response({'message': 'Domain removed successfully'}, status=status.HTTP_200_OK)


class CustomDomainViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for listing and retrieving Custom Domains
    """
    queryset = CustomDomain.objects.all()
    serializer_class = CustomDomainSerializer


class ProjectTeamViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing project team members
    """
    serializer_class = ProjectMembershipSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """
        Filter memberships based on user's role:
        - Super Admin: All memberships
        - Site Owner: Memberships for their projects
        - Collaborator: Their own memberships only
        """
        user = self.request.user
        
        # Super admins see all
        if hasattr(user, 'profile') and user.profile.is_super_admin:
            return ProjectMembership.objects.all()
        
        # Get project ID from URL if available
        project_id = self.kwargs.get('project_pk')
        if project_id:
            # Check if user is owner or member of this project
            try:
                site = WordPressSite.objects.get(id=project_id)
                if site.owner == user:
                    return ProjectMembership.objects.filter(project=site)
                # Check if user is a member
                if ProjectMembership.objects.filter(project=site, user=user).exists():
                    return ProjectMembership.objects.filter(project=site)
                return ProjectMembership.objects.none()
            except WordPressSite.DoesNotExist:
                return ProjectMembership.objects.none()
        
        # Return user's own memberships
        return ProjectMembership.objects.filter(user=user)
    
    def get_permissions(self):
        """
        Instantiate and return the list of permissions.
        """
        if self.action in ['create', 'destroy']:
            permission_classes = [IsAuthenticated, CanManageTeam]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]
    
    @action(detail=True, methods=['post'], url_path='invite')
    def invite_member(self, request, pk=None):
        """
        Invite a user to join the project team
        """
        site = self.get_object()
        
        serializer = InviteMemberSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        email = serializer.validated_data['email']
        role = serializer.validated_data.get('role', 'collaborator')
        
        try:
            invited_user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response(
                {'error': 'User not found. They must register first.'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Check if user is already a member
        if ProjectMembership.objects.filter(project=site, user=invited_user).exists():
            return Response(
                {'error': 'User is already a member of this project'},
                status=status.HTTP_409_CONFLICT
            )
        
        # Create membership
        membership = ProjectMembership.objects.create(
            project=site,
            user=invited_user,
            role=role,
            invited_by=request.user
        )
        
        # Log the action
        AuditLogger.log_member_invited(
            user=request.user,
            project=site,
            invited_user=invited_user,
            role=role,
            request=request
        )
        
        return Response(
            ProjectMembershipSerializer(membership).data,
            status=status.HTTP_201_CREATED
        )
    
    @action(detail=True, methods=['post'], url_path='remove/(?P<user_id>[^/.]+)')
    def remove_member(self, request, pk=None, user_id=None):
        """
        Remove a member from the project team
        """
        site = self.get_object()
        
        try:
            removed_user = User.objects.get(id=user_id)
            membership = ProjectMembership.objects.get(project=site, user=removed_user)
        except (User.DoesNotExist, ProjectMembership.DoesNotExist):
            return Response(
                {'error': 'Member not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Prevent removing the owner
        if membership.role == 'owner':
            return Response(
                {'error': 'Cannot remove the project owner'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Log the action
        AuditLogger.log_member_removed(
            user=request.user,
            project=site,
            removed_user=removed_user,
            request=request
        )
        
        membership.delete()
        
        return Response({'message': 'Member removed successfully'})
    
    @action(detail=True, methods=['get'])
    def members(self, request, pk=None):
        """
        List all team members for a project
        """
        site = self.get_object()
        
        # Check if user has access to this project
        if not (site.owner == request.user or 
                ProjectMembership.objects.filter(project=site, user=request.user).exists() or
                (hasattr(request.user, 'profile') and request.user.profile.is_super_admin)):
            return Response(
                {'error': 'You do not have access to this project'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        memberships = ProjectMembership.objects.filter(project=site)
        serializer = ProjectMembershipSerializer(memberships, many=True)
        
        return Response(serializer.data)


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for viewing audit logs
    """
    serializer_class = AuditLogSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """
        Filter audit logs based on user's role:
        - Super Admin: All logs
        - Site Owner: Logs for their projects + their own actions
        - Collaborator: Logs for their projects only
        """
        user = self.request.user
        
        # Super admins see all logs
        if hasattr(user, 'profile') and user.profile.is_super_admin:
            return AuditLog.objects.all()
        
        # Get project ID from query params if available
        project_id = self.request.query_params.get('project')
        if project_id:
            try:
                site = WordPressSite.objects.get(id=project_id)
                # Check if user has access to this project
                if (site.owner == user or 
                    ProjectMembership.objects.filter(project=site, user=user).exists()):
                    return AuditLog.objects.filter(project=site)
                return AuditLog.objects.none()
            except WordPressSite.DoesNotExist:
                return AuditLog.objects.none()
        
        # Return logs for user's projects + their own actions
        owned_projects = WordPressSite.objects.filter(owner=user)
        member_projects = ProjectMembership.objects.filter(user=user).values_list('project', flat=True)
        
        return AuditLog.objects.filter(
            Q(project__in=owned_projects) | 
            Q(project__in=member_projects) |
            Q(user=user)
        ).distinct()
    
    @action(detail=False, methods=['get'])
    def my_logs(self, request):
        """
        Get current user's activity logs
        """
        logs = AuditLog.objects.filter(user=request.user)[:50]
        serializer = AuditLogSerializer(logs, many=True)
        return Response(serializer.data)


class SuperAdminViewSet(viewsets.ViewSet):
    """
    ViewSet for Super Admin operations
    """
    permission_classes = [IsAuthenticated, IsSuperAdmin]
    
    @action(detail=False, methods=['get'])
    def server_stats(self, request):
        """
        Get comprehensive server statistics
        """
        # Get system stats
        cpu_percent = psutil.cpu_percent(interval=1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        
        # Get Docker stats
        try:
            client = docker.from_env()
            containers = client.containers.list()
            active_containers = len(containers)
        except Exception:
            active_containers = 0
        
        # Get platform stats
        total_users = User.objects.count()
        total_projects = WordPressSite.objects.count()
        
        # Calculate total storage used
        total_storage = 0
        for site in WordPressSite.objects.all():
            import os
            site_path = os.path.join('/home/adarsha/Desktop/projects/HOST/host/backend/wordpress_sites', site.name)
            if os.path.exists(site_path):
                for dirpath, dirnames, filenames in os.walk(site_path):
                    for filename in filenames:
                        filepath = os.path.join(dirpath, filename)
                        if os.path.exists(filepath):
                            total_storage += os.path.getsize(filepath)
        
        stats = {
            'total_users': total_users,
            'total_projects': total_projects,
            'active_containers': active_containers,
            'server_cpu_percent': cpu_percent,
            'server_memory_percent': memory.percent,
            'server_disk_usage_gb': round(disk.used / (1024**3), 2),
            'total_storage_used_gb': round(total_storage / (1024**3), 2)
        }
        
        serializer = ServerStatsSerializer(stats)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def all_users(self, request):
        """
        List all users with their profiles
        """
        users = User.objects.all().select_related('profile')
        data = []
        for user in users:
            user_data = UserSerializer(user).data
            if hasattr(user, 'profile'):
                user_data['platform_role'] = user.profile.platform_role
                user_data['project_quota'] = user.profile.project_quota
            data.append(user_data)
        return Response(data)
    
    @action(detail=True, methods=['post'])
    def impersonate(self, request, pk=None):
        """
        Login as a specific user (for support purposes)
        """
        try:
            user = User.objects.get(id=pk)
        except User.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Generate a token for the impersonated user
        from knox.models import AuthToken
        token = AuthToken.objects.create(user=user)[1]
        
        return Response({
            'token': token,
            'user': UserSerializer(user).data,
            'message': f'Impersonating user {user.email}'
        })
    
    @action(detail=False, methods=['post'])
    def emergency_stop(self, request):
        """
        Emergency stop all containers or a specific container
        """
        container_name = request.data.get('container_name')
        
        try:
            client = docker.from_env()
            
            if container_name:
                # Stop specific container
                container = client.containers.get(container_name)
                container.stop(timeout=10)
                return Response({'message': f'Container {container_name} stopped'})
            else:
                # Stop all containers
                containers = client.containers.list()
                for container in containers:
                    container.stop(timeout=10)
                return Response({'message': f'Stopped {len(containers)} containers'})
        
        except Exception as e:
            return Response(
                {'error': f'Failed to stop container: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'])
    def system_prune(self, request):
        """
        Clean up unused Docker resources
        """
        try:
            client = docker.from_env()
            
            # Prune containers
            containers_pruned = client.containers.prune()
            
            # Prune images
            images_pruned = client.images.prune()
            
            # Prune volumes
            volumes_pruned = client.volumes.prune()
            
            return Response({
                'message': 'System prune completed',
                'containers': containers_pruned,
                'images': images_pruned,
                'volumes': volumes_pruned
            })
        
        except Exception as e:
            return Response(
                {'error': f'Failed to prune system: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class UserProfileViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing user profiles
    """
    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Users can only see their own profile"""
        return UserProfile.objects.filter(user=self.request.user)
    
    @action(detail=False, methods=['get'])
    def me(self, request):
        """Get current user's profile"""
        profile, created = UserProfile.objects.get_or_create(
            user=request.user,
            defaults={'platform_role': 'user', 'project_quota': 5}
        )
        serializer = UserProfileSerializer(profile)
        return Response(serializer.data)
    
    @action(detail=False, methods=['patch'])
    def update_me(self, request):
        """Update current user's profile"""
        profile, created = UserProfile.objects.get_or_create(
            user=request.user,
            defaults={'platform_role': 'user', 'project_quota': 5}
        )
        
        # Only allow updating certain fields
        allowed_fields = ['email_notifications']
        for field in allowed_fields:
            if field in request.data:
                setattr(profile, field, request.data[field])
        
        profile.save()
        serializer = UserProfileSerializer(profile)
        return Response(serializer.data)
