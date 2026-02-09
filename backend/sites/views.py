from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.conf import settings
import secrets
import string

from .models import WordPressSite
from .serializers import WordPressSiteSerializer, WordPressSiteCreateSerializer
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
            db_success, db_config, db_error = db_manager.create_tenant_database(site_name)
            
            if not db_success:
                return Response(
                    {'error': f'Failed to create tenant database: {db_error}'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
            
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
                # Tenant database credentials
                db_container_name=db_config['container_name'],
                db_container_id=db_config['container_id'],
                db_host=db_config['db_host'],
                db_name=db_config['db_name'],
                db_user=db_config['db_user'],
                db_password=db_config['db_password'],
                db_root_password=db_config['root_password']
            )
            
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
                site.save()
                
                # Step 7: Automatic S3 Backup (Non-blocking)
                # Trigger backup after successful site creation
                try:
                    from core.s3_backup_manager import S3BackupManager
                    import threading
                    import gzip
                    import os
                    from .tenant_db_manager import TenantDatabaseManager
                    
                    def backup_new_site():
                        """Background task to backup newly created site"""
                        try:
                            s3_manager = S3BackupManager()
                            db_manager = TenantDatabaseManager()
                            
                            # Create database dump
                            success, dump_path, error = db_manager.snapshot_tenant_database(
                                site_name,
                                db_config['root_password']
                            )
                            
                            if success and dump_path:
                                # Compress the dump
                                gz_path = dump_path + '.gz'
                                with open(dump_path, 'rb') as f_in:
                                    with gzip.open(gz_path, 'wb', compresslevel=6) as f_out:
                                        f_out.writelines(f_in)
                                
                                # Upload to S3
                                upload_success, s3_key, upload_error = s3_manager.upload_backup(
                                    gz_path,
                                    site_name,
                                    backup_type='tenant'
                                )
                                
                                # Cleanup temporary files
                                if os.path.exists(dump_path):
                                    os.remove(dump_path)
                                if os.path.exists(gz_path):
                                    os.remove(gz_path)
                                
                                if upload_success:
                                    print(f"✓ Auto-backup successful for {site_name}: {s3_key}")
                                else:
                                    print(f"✗ Auto-backup upload failed for {site_name}: {upload_error}")
                            else:
                                print(f"✗ Auto-backup dump failed for {site_name}: {error}")
                                
                        except Exception as e:
                            print(f"✗ Auto-backup error for {site_name}: {str(e)}")
                    
                    # Run backup in background thread (non-blocking)
                    backup_thread = threading.Thread(target=backup_new_site, daemon=True)
                    backup_thread.start()
                    
                except Exception as e:
                    # Don't fail site creation if backup fails
                    print(f"Warning: Auto-backup initialization failed: {str(e)}")
                
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
            }
        })

