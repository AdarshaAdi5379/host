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
            ['docker-compose', 'up', '-d'],
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
        return False, "Docker or docker-compose not found. Please ensure Docker Desktop is installed and running."
    except Exception as e:
        return False, f"Unexpected error: {str(e)}"


def run_docker_compose_down(site_directory: str) -> tuple[bool, str]:
    """
    Stop Docker containers using docker-compose down
    
    Args:
        site_directory: Path to the directory containing docker-compose.yml
    
    Returns:
        tuple: (success: bool, output: str)
    """
    try:
        result = subprocess.run(
            ['docker-compose', 'down'],
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
        return False, "Docker or docker-compose not found"
    except Exception as e:
        return False, f"Unexpected error: {str(e)}"


def run_docker_compose_down_volumes(site_directory: str) -> tuple[bool, str]:
    """
    Stop and remove Docker containers and volumes using docker-compose down -v
    
    Args:
        site_directory: Path to the directory containing docker-compose.yml
    
    Returns:
        tuple: (success: bool, output: str)
    """
    try:
        result = subprocess.run(
            ['docker-compose', 'down', '-v'],
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
        return False, "Docker compose down -v timed out"
    except FileNotFoundError:
        return False, "Docker or docker-compose not found"
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
