"""
Docker execution utilities for WordPress Orchestrator
"""
import subprocess
import os
from pathlib import Path


def run_docker_compose_up(site_directory: str) -> tuple[bool, str]:
    """
    Start Docker containers using docker-compose up -d
    
    Args:
        site_directory: Path to the directory containing docker-compose.yml
    
    Returns:
        tuple: (success: bool, output: str)
    """
    try:
        result = subprocess.run(
            ['docker', 'compose', 'up', '-d'],  # Use 'docker compose' (v2)
            cwd=site_directory,
            capture_output=True,
            text=True,
            timeout=300  # 5 minute timeout
        )
        
        if result.returncode == 0:
            return True, result.stdout
        else:
            return False, result.stderr
            
    except subprocess.TimeoutExpired:
        return False, "Docker compose command timed out after 5 minutes"
    except FileNotFoundError:
        return False, "Docker command not found. Please ensure Docker is installed."
    except Exception as e:
        return False, f"Unexpected error: {str(e)}"


def run_docker_compose_down(site_directory: str) -> tuple[bool, str]:
    """
    Stop Docker containers using docker compose down
    
    Args:
        site_directory: Path to the directory containing docker-compose.yml
    
    Returns:
        tuple: (success: bool, output: str)
    """
    try:
        result = subprocess.run(
            ['docker', 'compose', 'down'],  # Use 'docker compose' (v2)
            cwd=site_directory,
            capture_output=True,
            text=True,
            timeout=60
        )
        
        if result.returncode == 0:
            return True, result.stdout
        else:
            return False, result.stderr
            
    except subprocess.TimeoutExpired:
        return False, "Docker compose down timed out"
    except FileNotFoundError:
        return False, "Docker command not found"
    except Exception as e:
        return False, f"Unexpected error: {str(e)}"


def run_docker_compose_down_volumes(site_directory: str) -> tuple[bool, str]:
    """
    Stop and remove Docker containers and volumes using docker compose down -v
    
    Args:
        site_directory: Path to the directory containing docker-compose.yml
    
    Returns:
        tuple: (success: bool, output: str)
    """
    try:
        result = subprocess.run(
            ['docker', 'compose', 'down', '-v', '--remove-orphans'],  # Added --remove-orphans for thorough cleanup
            cwd=site_directory,
            capture_output=True,
            text=True,
            timeout=30  # Reduced from 60s - force faster cleanup
        )
        
        if result.returncode == 0:
            return True, result.stdout
        else:
            return False, result.stderr
            
    except subprocess.TimeoutExpired:
        return False, "Docker compose down -v timed out"
    except FileNotFoundError:
        return False, "Docker command not found"
    except Exception as e:
        return False, f"Unexpected error: {str(e)}"


def check_docker_running() -> bool:
    """
    Check if Docker daemon is running
    
    Returns:
        bool: True if Docker is running, False otherwise
    """
    try:
        result = subprocess.run(
            ['docker', 'info'],
            capture_output=True,
            timeout=5
        )
        return result.returncode == 0
    except:
        return False

def get_container_stats(container_name: str) -> dict:
    """
    Get real-time CPU and Memory stats for a container
    
    Args:
        container_name: Name of the container to query
        
    Returns:
        dict: {
            'cpu_percent': float,
            'memory_usage_mb': float,
            'memory_limit_mb': float,
            'memory_percent': float,
            'status': str
        } or None if container not found
    """
    try:
        import docker
        client = docker.from_env()
        
        try:
            container = client.containers.get(container_name)
            
            if container.status != 'running':
                return {
                    'status': 'offline',
                    'cpu_percent': 0,
                    'memory_usage_mb': 0,
                    'memory_limit_mb': 0,
                    'memory_percent': 0
                }
                
            # Get stats (stream=False to get a single snapshot)
            stats = container.stats(stream=False)
            
            # --- CPU Calculation ---
            # Based on Docker CLI implementation
            cpu_delta = stats['cpu_stats']['cpu_usage']['total_usage'] - \
                        stats['precpu_stats']['cpu_usage']['total_usage']
                        
            system_delta = stats['cpu_stats']['system_cpu_usage'] - \
                           stats['precpu_stats']['system_cpu_usage']
                           
            online_cpus = stats['cpu_stats'].get('online_cpus', 1)
            
            if system_delta > 0 and cpu_delta > 0:
                cpu_percent = (cpu_delta / system_delta) * online_cpus * 100.0
            else:
                cpu_percent = 0.0
                
            # --- Memory Calculation ---
            memory_usage = stats['memory_stats']['usage']
            # Adjust for cache if available (Docker CLI does this)
            if 'cache' in stats['memory_stats'].get('stats', {}):
                memory_usage -= stats['memory_stats']['stats']['cache']
                
            memory_limit = stats['memory_stats']['limit']
            memory_percent = (memory_usage / memory_limit) * 100.0
            
            return {
                'status': 'online',
                'cpu_percent': round(cpu_percent, 2),
                'memory_usage_mb': round(memory_usage / (1024 * 1024), 2),
                'memory_limit_mb': round(memory_limit / (1024 * 1024), 2),
                'memory_percent': round(memory_percent, 2)
            }
            
        except docker.errors.NotFound:
            return None
            
    except ImportError:
        # Fallback if docker-py is not installed (though it should be)
        return None
    except Exception as e:
        print(f"Error fetching stats for {container_name}: {e}")
        return None


def scale_backend_service(site_directory: str, service_name: str, replica_count: int) -> tuple[bool, str]:
    """
    Scale a specific service in a docker-compose project to ``replica_count`` instances.

    Uses ``docker compose up -d --scale {service}={count} --no-recreate`` so that
    only the target service is scaled — the frontend and DB containers are untouched.

    Args:
        site_directory: Absolute path to the directory containing docker-compose.yml.
        service_name:   Compose service name to scale (e.g. ``mysite_backend``).
        replica_count:  Desired number of replicas (1–10).

    Returns:
        tuple: (success: bool, output: str)
    """
    if not 1 <= replica_count <= 10:
        return False, f"replica_count must be between 1 and 10, got {replica_count}"

    try:
        result = subprocess.run(
            [
                "docker", "compose", "up", "-d",
                f"--scale={service_name}={replica_count}",
                "--no-recreate",  # don't restart already-running containers for other services
            ],
            cwd=site_directory,
            capture_output=True,
            text=True,
            timeout=300,
        )
        if result.returncode == 0:
            return True, result.stdout or f"Scaled {service_name} to {replica_count} replicas"
        return False, result.stderr or "docker compose scale returned non-zero exit code"

    except subprocess.TimeoutExpired:
        return False, "docker compose scale timed out after 5 minutes"
    except FileNotFoundError:
        return False, "docker command not found — is Docker installed?"
    except Exception as exc:
        return False, f"Unexpected error during scale: {exc}"
