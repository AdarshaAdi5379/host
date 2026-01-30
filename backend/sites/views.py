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
    generate_nginx_config
)
from .docker_utils import (
    run_docker_compose_up,
    run_docker_compose_down,
    run_docker_compose_down_volumes,
    check_docker_running
)
from .hosts_manager import (
    add_hosts_entry,
    remove_hosts_entry,
    is_admin
)
from .nginx_manager import (
    write_site_config,
    remove_site_config,
    reload_nginx,
    is_nginx_running
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
                site.status = 'running'
                site.save()
            else:
                site.status = 'error'
                site.save()
                return Response(
                    {'error': f'Site created but failed to start containers: {output}'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
            
            # Add hosts file entry for .local domain
            hosts_success, hosts_message = add_hosts_entry(domain)
            if not hosts_success:
                # Don't fail site creation, just warn
                print(f"Warning: {hosts_message}")
            
            # Generate Nginx configuration
            nginx_success, nginx_message, config_path = write_site_config(site.name, domain, port)
            if nginx_success:
                print(f"Nginx config created: {config_path}")
                # Reload Nginx to apply changes
                reload_success, reload_message = reload_nginx()
                if reload_success:
                    print(f"Nginx reloaded: {reload_message}")
                else:
                    print(f"Warning: {reload_message}")
            else:
                print(f"Warning: {nginx_message}")
            
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
            
            # Ensure networking (Hosts + Nginx) is set up
            # This handles cases where sites were created before Phase 4
            # or if configs were lost/cleared.
            
            # 1. Hosts File
            hosts_success, hosts_message = add_hosts_entry(site.domain)
            if not hosts_success:
                print(f"Start Warning: {hosts_message}")
                
            # 2. Nginx Config
            nginx_success, nginx_message, config_path = write_site_config(site.name, site.domain, site.port)
            if nginx_success:
                reload_success, reload_message = reload_nginx()
                if not reload_success:
                    print(f"Start Warning: {reload_message}")
            else:
                print(f"Start Warning: {nginx_message}")
                
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
        
        # Remove hosts file entry
        hosts_success, hosts_message = remove_hosts_entry(site.domain)
        if not hosts_success:
            print(f"Warning: {hosts_message}")
        
        # Remove Nginx configuration
        nginx_success, nginx_message = remove_site_config(site.name)
        if nginx_success:
            print(f"Nginx config removed: {nginx_message}")
            # Reload Nginx to apply changes
            reload_success, reload_message = reload_nginx()
            if reload_success:
                print(f"Nginx reloaded: {reload_message}")
            else:
                print(f"Warning: {reload_message}")
        else:
            print(f"Warning: {nginx_message}")
        
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
