"""
Project API gateway manager.

Responsible for rendering per-project frontend nginx config and applying it
safely (test -> reload -> rollback) with per-project serialization.
"""
from __future__ import annotations

import hashlib
import os
import subprocess
import threading
import time
from pathlib import Path

import yaml
from django.conf import settings
from django.utils import timezone

from .gateway_routing import RenderedRoute, render_frontend_gateway_nginx
from .models import ApiRoute, ProjectService, WordPressSite


_GATEWAY_LOCK_GUARD = threading.Lock()
_GATEWAY_LOCKS: dict[int, threading.Lock] = {}


def _get_site_lock(site_id: int) -> threading.Lock:
    with _GATEWAY_LOCK_GUARD:
        if site_id not in _GATEWAY_LOCKS:
            _GATEWAY_LOCKS[site_id] = threading.Lock()
        return _GATEWAY_LOCKS[site_id]


def _latest_gateway_change(site_id: int):
    latest_route = (
        ApiRoute.objects
        .filter(site_id=site_id)
        .order_by('-updated_at')
        .values_list('updated_at', flat=True)
        .first()
    )
    latest_service = (
        ProjectService.objects
        .filter(site_id=site_id)
        .order_by('-updated_at')
        .values_list('updated_at', flat=True)
        .first()
    )

    candidates = [dt for dt in [latest_route, latest_service] if dt is not None]
    return max(candidates) if candidates else None


def _discover_backend_services(site: WordPressSite) -> list[str]:
    """Infer backend service names from docker-compose for the project."""
    compose_path = Path(site.site_directory) / 'docker-compose.yml'
    if not compose_path.exists():
        return [f'{site.name}_backend']

    try:
        compose_data = yaml.safe_load(compose_path.read_text()) or {}
        services = compose_data.get('services', {})
    except Exception:
        return [f'{site.name}_backend']

    base_name = f'{site.name}_backend'
    names = [name for name in services.keys() if name == base_name or name.startswith(f'{base_name}_')]

    if not names:
        return [base_name]

    def _service_sort_key(name: str):
        if name == base_name:
            return (0, 0)
        suffix = name.replace(f'{base_name}_', '', 1)
        if suffix.isdigit():
            return (1, int(suffix))
        return (2, suffix)

    return sorted(names, key=_service_sort_key)


def render_site_gateway_config(site: WordPressSite) -> str:
    backend_services = _discover_backend_services(site)

    route_rows = (
        ApiRoute.objects
        .select_related('service')
        .filter(
            site=site,
            is_enabled=True,
            service__is_active=True,
        )
    )

    routes = [
        RenderedRoute(
            path=route.path,
            target_url=f"{route.service.protocol}://{route.service.container_name}:{route.service.internal_port}",
            strip_prefix=route.strip_prefix,
        )
        for route in route_rows
    ]

    return render_frontend_gateway_nginx(
        site_name=site.name,
        backend_services=backend_services,
        custom_routes=routes,
    )


def _run_docker_exec(site_name: str, *args: str, timeout: int = 15) -> tuple[bool, str]:
    cmd = ['docker', 'exec', f'{site_name}_frontend', *args]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        output = (result.stdout or '') + (result.stderr or '')
        return result.returncode == 0, output.strip()
    except Exception as exc:
        return False, str(exc)


def apply_site_gateway_config(site: WordPressSite) -> tuple[bool, str]:
    """
    Apply rendered gateway config for a site.

    Returns:
      (success, status_message)
    """
    if site.framework != 'react_django':
        return False, 'API gateway routing is only supported for react_django projects.'

    lock = _get_site_lock(site.id)
    debounce_seconds = float(getattr(settings, 'GATEWAY_RELOAD_DEBOUNCE_SECONDS', 0.5))

    with lock:
        # Wait for a quiet window so bursts of edits collapse into one apply.
        while True:
            latest_change = _latest_gateway_change(site.id)
            if latest_change is None:
                break

            age = (timezone.now() - latest_change).total_seconds()
            remaining = debounce_seconds - age
            if remaining <= 0:
                break
            time.sleep(min(remaining, debounce_seconds))

        config_text = render_site_gateway_config(site)
        config_hash = hashlib.sha256(config_text.encode('utf-8')).hexdigest()

        # Re-read current record inside lock to avoid stale hash checks.
        site = WordPressSite.objects.get(id=site.id)
        if site.gateway_config_hash == config_hash:
            return True, 'No gateway config changes detected.'

        conf_path = Path(site.site_directory) / 'frontend_nginx.conf'
        tmp_path = conf_path.with_suffix('.conf.tmp')

        previous_content = conf_path.read_text() if conf_path.exists() else None

        try:
            tmp_path.write_text(config_text)
            os.replace(tmp_path, conf_path)
        except Exception as exc:
            site.gateway_last_error = f'Failed to write gateway config: {exc}'
            site.save(update_fields=['gateway_last_error'])
            return False, site.gateway_last_error

        if site.status != 'running':
            site.gateway_config_hash = config_hash
            site.gateway_last_synced_at = timezone.now()
            site.gateway_last_error = ''
            site.save(update_fields=['gateway_config_hash', 'gateway_last_synced_at', 'gateway_last_error'])
            return True, 'Gateway config saved; reload deferred because project is not running.'

        ok, test_output = _run_docker_exec(site.name, 'nginx', '-t')
        if not ok:
            # Roll back to previous known-good config
            try:
                if previous_content is None:
                    conf_path.unlink(missing_ok=True)
                else:
                    conf_path.write_text(previous_content)
            except Exception:
                pass

            site.gateway_last_error = f'Gateway config test failed: {test_output}'
            site.save(update_fields=['gateway_last_error'])
            return False, site.gateway_last_error

        ok, reload_output = _run_docker_exec(site.name, 'nginx', '-s', 'reload')
        if not ok:
            # Roll back and attempt to restore running config.
            try:
                if previous_content is None:
                    conf_path.unlink(missing_ok=True)
                else:
                    conf_path.write_text(previous_content)
                _run_docker_exec(site.name, 'nginx', '-t')
                _run_docker_exec(site.name, 'nginx', '-s', 'reload')
            except Exception:
                pass

            site.gateway_last_error = f'Gateway reload failed: {reload_output}'
            site.save(update_fields=['gateway_last_error'])
            return False, site.gateway_last_error

        site.gateway_config_hash = config_hash
        site.gateway_last_synced_at = timezone.now()
        site.gateway_last_error = ''
        site.save(update_fields=['gateway_config_hash', 'gateway_last_synced_at', 'gateway_last_error'])

        return True, 'Gateway reloaded successfully.'
