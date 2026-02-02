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
            # Generate configuration
            port = find_available_port()
            domain = f"{site_name}.local"
            
            # Generate secure DB password
            db_password = ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(16))
            
            # Create site directory
            site_dir = create_site_directory(site_name)
            
            # Generate and write wp-config.php
            wp_config_content = generate_wp_config_content(
                db_host=f"{site_name}_db:3306",
                db_name='wordpress',
                db_user='wordpress',
                db_password=db_password
            )
            write_wp_config(site_dir, wp_config_content)
            
            # Generate and write docker-compose.yml
            compose_config = generate_docker_compose(site_name, db_password, port)
            compose_path = write_docker_compose(site_dir, compose_config)
            
            # Create database record
            site = WordPressSite.objects.create(
                name=site_name,
                domain=domain,
                port=port,
                admin_username=admin_username,
                admin_password=admin_password,  # In production, hash this
                site_directory=site_dir,
                docker_compose_path=compose_path,
                status='provisioning'
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
        

        
        # Stop and remove containers and volumes
        success, output = run_docker_compose_down_volumes(site.site_directory)
        
        if not success:
            return Response(
                {'error': f'Failed to remove containers: {output}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        # Delete site record
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
    def start_tunnel(self, request, pk=None):
        """
        Start a Cloudflare tunnel for the site
        Returns: { "tunnel_url": "https://xyz.trycloudflare.com" }
        """
        site = self.get_object()
        
        # Import tunnel manager
        from .tunnel_manager import start_tunnel, check_cloudflared_installed, get_installation_instructions
        
        # Check if site is running
        if site.status != 'running':
            return Response(
                {'error': 'Site must be running before starting a tunnel'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if tunnel is already active
        if site.tunnel_active:
            return Response(
                {'error': 'Tunnel is already active', 'tunnel_url': site.tunnel_url},
                status=status.HTTP_409_CONFLICT
            )
        
        # Check if cloudflared is installed
        if not check_cloudflared_installed():
            return Response(
                {
                    'error': 'cloudflared binary not found',
                    'instructions': get_installation_instructions()
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        # Start the tunnel
        pid, tunnel_url, error = start_tunnel(site.port)
        
        if error:
            return Response(
                {'error': error},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        # Update site record
        site.tunnel_url = tunnel_url
        site.tunnel_active = True
        site.tunnel_process_id = pid
        site.save()
        
        return Response({
            'tunnel_url': tunnel_url,
            'status': 'Tunnel started successfully'
        })
    
    @action(detail=True, methods=['post'])
    def stop_tunnel(self, request, pk=None):
        """
        Stop the active Cloudflare tunnel
        Returns: { "status": "Tunnel stopped" }
        """
        site = self.get_object()
        
        # Import tunnel manager
        from .tunnel_manager import stop_tunnel, is_tunnel_alive
        
        # Check if tunnel is active
        if not site.tunnel_active:
            return Response(
                {'error': 'No active tunnel to stop'},
                status=status.HTTP_409_CONFLICT
            )
        
        # Stop the tunnel
        success, error = stop_tunnel(site.tunnel_process_id)
        
        if not success and error:
            return Response(
                {'error': error},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        # Update site record
        site.tunnel_url = None
        site.tunnel_active = False
        site.tunnel_process_id = None
        site.save()
        
        return Response({
            'status': 'Tunnel stopped successfully'
        })
    
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

