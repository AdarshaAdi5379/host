"""
Docker execution utilities for WordPress Orchestrator
"""
import subprocess
import os
import re
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


def _safe_compose_project_name(value: str) -> str:
    """
    Convert arbitrary site/directory names into docker compose project-compatible names.
    """
    cleaned = re.sub(r'[^a-z0-9_-]', '', value.strip().lower())
    if not cleaned:
        return "site"
    if not cleaned[0].isalnum():
        cleaned = f"p{cleaned}"
    return cleaned


def _run_quiet(cmd: list[str], *, cwd: str | None = None, timeout: int = 90) -> tuple[bool, str]:
    try:
        result = subprocess.run(
            cmd,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
    except Exception as exc:
        return False, str(exc)

    if result.returncode == 0:
        return True, (result.stdout or "").strip()
    return False, (result.stderr or result.stdout or "").strip()


def _split_lines(raw: str) -> list[str]:
    return [line.strip() for line in (raw or "").splitlines() if line.strip()]


def cleanup_compose_project_resources(site_name: str, site_directory: str) -> tuple[bool, dict]:
    """
    Best-effort deep cleanup for compose resources to avoid leaked networks/subnets.
    Returns (ok, report). ok=False indicates at least one cleanup step failed.
    """
    site_dir_name = Path(site_directory).name
    candidates = {
        _safe_compose_project_name(site_name),
        _safe_compose_project_name(site_dir_name),
    }

    report = {
        "projects": sorted(candidates),
        "removed": {
            "containers": 0,
            "volumes": 0,
            "networks": 0,
        },
        "errors": [],
        "warnings": [],
    }

    compose_file = Path(site_directory) / "docker-compose.yml"
    if not compose_file.exists():
        report["warnings"].append(f"compose file not found at {compose_file}; running label-based cleanup only")

    for project in sorted(candidates):
        # Compose-aware teardown
        if compose_file.exists():
            ok, out = _run_quiet(
                ['docker', 'compose', '-p', project, 'down', '-v', '--remove-orphans'],
                cwd=site_directory,
                timeout=120,
            )
            if not ok and out:
                report["warnings"].append(f"compose down for '{project}' returned: {out}")

        # Remove containers by compose project label.
        ok, out = _run_quiet(
            ['docker', 'ps', '-aq', '--filter', f'label=com.docker.compose.project={project}'],
            timeout=30,
        )
        if ok:
            container_ids = _split_lines(out)
            if container_ids:
                ok_rm, out_rm = _run_quiet(['docker', 'rm', '-f', *container_ids], timeout=60)
                if ok_rm:
                    report["removed"]["containers"] += len(container_ids)
                else:
                    report["errors"].append(f"failed removing containers for '{project}': {out_rm}")
        else:
            report["errors"].append(f"failed listing containers for '{project}': {out}")

        # Remove networks by compose project label.
        ok, out = _run_quiet(
            ['docker', 'network', 'ls', '-q', '--filter', f'label=com.docker.compose.project={project}'],
            timeout=30,
        )
        if ok:
            network_ids = _split_lines(out)
            for net_id in network_ids:
                ok_rm, out_rm = _run_quiet(['docker', 'network', 'rm', net_id], timeout=30)
                if ok_rm:
                    report["removed"]["networks"] += 1
                elif "No such network" not in out_rm:
                    report["errors"].append(f"failed removing network '{net_id}': {out_rm}")
        else:
            report["errors"].append(f"failed listing networks for '{project}': {out}")

        # Remove volumes by compose project label.
        ok, out = _run_quiet(
            ['docker', 'volume', 'ls', '-q', '--filter', f'label=com.docker.compose.project={project}'],
            timeout=30,
        )
        if ok:
            volume_names = _split_lines(out)
            if volume_names:
                ok_rm, out_rm = _run_quiet(['docker', 'volume', 'rm', '-f', *volume_names], timeout=60)
                if ok_rm:
                    report["removed"]["volumes"] += len(volume_names)
                else:
                    report["errors"].append(f"failed removing volumes for '{project}': {out_rm}")
        else:
            report["errors"].append(f"failed listing volumes for '{project}': {out}")

    # Fallback removal for known leaked network names.
    fallback_names = set()
    for project in candidates:
        fallback_names.update({
            f"{project}_vpc_private_db",
            f"{project}_vpc_public_web",
            f"{project}_{project}_vpc_private_db",
            f"{project}_{project}_vpc_public_web",
        })

    for network_name in sorted(fallback_names):
        ok_rm, out_rm = _run_quiet(['docker', 'network', 'rm', network_name], timeout=20)
        if ok_rm:
            report["removed"]["networks"] += 1
        elif out_rm and "No such network" not in out_rm and "has active endpoints" not in out_rm:
            report["warnings"].append(f"network '{network_name}' removal: {out_rm}")

    return (len(report["errors"]) == 0), report


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
    Get real-time CPU and Memory stats for a container using docker stats CLI.

    Uses `docker stats --no-stream` (same as Docker CLI) which is fast, accurate,
    and avoids the Python SDK issue where the first sample has precpu_stats=0
    (causing cpu_percent to always report 0%).

    Returns:
        dict with cpu_percent, memory_usage_mb, memory_limit_mb, memory_percent, status
        or None if container not found / docker unavailable.
    """
    import subprocess
    import json

    try:
        result = subprocess.run(
            [
                'docker', 'stats', '--no-stream', '--format',
                '{"cpu":"{{.CPUPerc}}","mem_usage":"{{.MemUsage}}","mem_perc":"{{.MemPerc}}","status":"{{.Status}}"}',
                container_name,
            ],
            capture_output=True,
            text=True,
            timeout=10,
        )

        if result.returncode != 0:
            # Container not found or docker unavailable
            return None

        raw = result.stdout.strip()
        if not raw:
            return None

        data = json.loads(raw)

        def pct(s: str) -> float:
            """Strip % and convert to float."""
            return float(s.replace('%', '').strip() or '0')

        def mem_mb(s: str) -> float:
            """Convert memory string like '97.5MiB' or '2.1GiB' to MB."""
            s = s.strip()
            if s.endswith('GiB'):
                return float(s[:-3]) * 1024
            if s.endswith('MiB'):
                return float(s[:-3])
            if s.endswith('kB') or s.endswith('KiB'):
                return float(s[:-2]) / 1024
            if s.endswith('GB'):
                return float(s[:-2]) * 1000
            if s.endswith('MB'):
                return float(s[:-2])
            if s.endswith('B'):
                return float(s[:-1]) / (1024 * 1024)
            return 0.0

        # mem_usage is "97.5MiB / 15.32GiB"
        mem_parts = data.get('mem_usage', '0MiB / 0MiB').split('/')
        usage_mb = mem_mb(mem_parts[0]) if len(mem_parts) > 0 else 0.0
        limit_mb = mem_mb(mem_parts[1]) if len(mem_parts) > 1 else 0.0
        mem_pct = pct(data.get('mem_perc', '0%'))
        cpu_pct = pct(data.get('cpu', '0%'))

        return {
            'status': 'online',
            'cpu_percent': round(cpu_pct, 2),
            'memory_usage_mb': round(usage_mb, 2),
            'memory_limit_mb': round(limit_mb, 2),
            'memory_percent': round(mem_pct, 2),
        }

    except (subprocess.TimeoutExpired, FileNotFoundError):
        return None
    except Exception as e:
        print(f"Error fetching stats for {container_name}: {e}")
        return None


def get_container_stats_batch(container_names: list) -> dict:
    """
    Get stats for multiple containers in a SINGLE docker stats call.

    Much faster than calling get_container_stats() per container — all
    containers are queried simultaneously, so latency is O(1) not O(N).

    Returns:
        dict mapping container_name → stats dict (or None if not found).
    """
    import subprocess
    import json

    if not container_names:
        return {}

    result_map = {name: None for name in container_names}

    try:
        result = subprocess.run(
            [
                'docker', 'stats', '--no-stream', '--format',
                '{"name":"{{.Name}}","cpu":"{{.CPUPerc}}","mem_usage":"{{.MemUsage}}","mem_perc":"{{.MemPerc}}"}',
            ] + container_names,
            capture_output=True,
            text=True,
            timeout=10,
        )

        if result.returncode != 0 or not result.stdout.strip():
            return result_map

        def pct(s: str) -> float:
            return float(s.replace('%', '').strip() or '0')

        def mem_mb(s: str) -> float:
            s = s.strip()
            if s.endswith('GiB'):
                return float(s[:-3]) * 1024
            if s.endswith('MiB'):
                return float(s[:-3])
            if s.endswith('kB') or s.endswith('KiB'):
                return float(s[:-2]) / 1024
            if s.endswith('GB'):
                return float(s[:-2]) * 1000
            if s.endswith('MB'):
                return float(s[:-2])
            if s.endswith('B'):
                return float(s[:-1]) / (1024 * 1024)
            return 0.0

        for line in result.stdout.strip().splitlines():
            try:
                data = json.loads(line)
                cname = data.get('name', '')
                mem_parts = data.get('mem_usage', '0MiB / 0MiB').split('/')
                usage_mb = mem_mb(mem_parts[0]) if len(mem_parts) > 0 else 0.0
                limit_mb = mem_mb(mem_parts[1]) if len(mem_parts) > 1 else 0.0
                cpu_pct = pct(data.get('cpu', '0%'))
                mem_pct = pct(data.get('mem_perc', '0%'))
                result_map[cname] = {
                    'status': 'online',
                    'cpu_percent': round(cpu_pct, 2),
                    'memory_usage_mb': round(usage_mb, 2),
                    'memory_limit_mb': round(limit_mb, 2),
                    'memory_percent': round(mem_pct, 2),
                }
            except (json.JSONDecodeError, ValueError):
                continue

    except (subprocess.TimeoutExpired, FileNotFoundError):
        pass
    except Exception as e:
        print(f"Error in batch stats: {e}")

    return result_map


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
