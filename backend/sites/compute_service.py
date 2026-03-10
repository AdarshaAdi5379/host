"""
Compute lifecycle orchestration service.
"""
from __future__ import annotations

import time
from pathlib import Path

from django.conf import settings
from django.utils import timezone

from .compute_driver import ComputeDriverError, LibvirtComputeDriver
from .compute_firewall import SecurityGroupFirewallManager
from .compute_jobs import record_compute_event
from .models import ComputeInstance, ComputeOperation


class ComputeService:
    def __init__(self, driver: LibvirtComputeDriver | None = None):
        self.driver = driver or LibvirtComputeDriver(
            network_name=getattr(settings, 'COMPUTE_LIBVIRT_NETWORK', 'default')
        )
        self.firewall = SecurityGroupFirewallManager()

    def execute_operation(self, op: ComputeOperation) -> tuple[bool, str, dict]:
        instance = op.instance
        operation = op.operation
        payload = op.request_payload or {}
        try:
            if operation == 'create':
                data = self.create_instance(instance, payload)
            elif operation == 'start':
                data = self.start_instance(instance)
            elif operation == 'stop':
                data = self.stop_instance(instance)
            elif operation == 'reboot':
                data = self.reboot_instance(instance)
            elif operation == 'terminate':
                data = self.terminate_instance(instance)
            elif operation in {'describe', 'reconcile'}:
                data = self.describe_instance(instance)
            else:
                raise RuntimeError(f"Unsupported operation: {operation}")

            record_compute_event(
                instance=instance,
                operation=op,
                created_by=op.requested_by,
                event_type='operation_success',
                message=f'{operation} succeeded',
                metadata=data,
            )
            return True, f'{operation} succeeded', data
        except Exception as exc:
            error = str(exc)
            instance.last_error = error
            if instance.state not in {'terminated', 'terminating'}:
                instance.state = 'error'
            instance.save(update_fields=['state', 'last_error', 'updated_at'])
            record_compute_event(
                instance=instance,
                operation=op,
                created_by=op.requested_by,
                event_type='operation_failed',
                message=f'{operation} failed',
                metadata={'error': error},
            )
            return False, error, {}

    def _sync_instance_firewall(self, instance: ComputeInstance, operation: ComputeOperation | None = None) -> dict:
        if not self.firewall.enabled:
            return {'enabled': False, 'message': 'compute firewall disabled'}

        if instance.state == 'running' and instance.private_ip:
            result = self.firewall.apply_instance_rules(instance)
            event_type = 'firewall_applied' if result.ok else 'firewall_apply_failed'
        else:
            result = self.firewall.clear_instance_rules(instance)
            event_type = 'firewall_cleared' if result.ok else 'firewall_clear_failed'

        record_compute_event(
            instance=instance,
            operation=operation,
            event_type=event_type,
            message=result.message,
            metadata=result.details,
        )

        if not result.ok and self.firewall.strict:
            raise ComputeDriverError(result.message)

        return {
            'enabled': self.firewall.enabled,
            'ok': result.ok,
            'message': result.message,
            **(result.details or {}),
        }

    @staticmethod
    def _storage_paths(instance: ComputeInstance) -> tuple[str, str]:
        disks_dir = Path(getattr(settings, 'COMPUTE_DISKS_DIR', '/var/lib/host/compute/disks'))
        seeds_dir = Path(getattr(settings, 'COMPUTE_SEEDS_DIR', '/var/lib/host/compute/seeds'))
        disk_path = str(disks_dir / f"{instance.instance_id}.qcow2")
        seed_path = str(seeds_dir / f"{instance.instance_id}.iso")
        return disk_path, seed_path

    def _rollback_failed_create(self, instance: ComputeInstance, disk_path: str, seed_iso_path: str):
        """
        Deterministic compensating cleanup for partially created VM assets.
        """
        try:
            if self.driver.domain_exists(instance.libvirt_domain_name):
                self.driver.destroy_domain(instance.libvirt_domain_name)
                self.driver.undefine_domain(instance.libvirt_domain_name)
        except Exception:
            pass

        for candidate in (disk_path, seed_iso_path):
            if not candidate:
                continue
            try:
                path = Path(candidate)
                if path.exists():
                    path.unlink()
            except Exception:
                pass

    @staticmethod
    def _map_libvirt_state(libvirt_state: str) -> str:
        text = (libvirt_state or '').lower()
        if 'running' in text:
            return 'running'
        if 'shut off' in text or 'shutdown' in text or 'paused' in text:
            return 'stopped'
        if 'in shutdown' in text:
            return 'stopping'
        if 'crashed' in text:
            return 'error'
        return 'pending'

    def create_instance(self, instance: ComputeInstance, payload: dict | None = None) -> dict:
        payload = payload or {}
        if not instance.image.is_active:
            raise ComputeDriverError('Selected image is inactive.')
        if not instance.flavor.is_active:
            raise ComputeDriverError('Selected flavor is inactive.')
        if not instance.ssh_key_id:
            raise ComputeDriverError('SSH key is required. Password auth is not allowed.')

        if instance.state in {'running', 'stopped', 'pending'} and instance.disk_path and instance.seed_iso_path:
            return self.describe_instance(instance)

        disk_path, seed_iso_path = self._storage_paths(instance)
        try:
            self.driver.create_overlay_disk(
                base_image_path=instance.image.local_path,
                disk_path=disk_path,
                disk_gb=max(instance.flavor.disk_gb, instance.image.minimum_disk_gb),
            )
            self.driver.create_cloud_init_seed(
                instance_id=instance.instance_id,
                vm_name=instance.libvirt_domain_name,
                ssh_public_key=instance.ssh_key.public_key,
                seed_iso_path=seed_iso_path,
                username=str(payload.get('ssh_username') or 'ubuntu'),
            )
            self.driver.create_domain(
                domain_name=instance.libvirt_domain_name,
                memory_mb=instance.flavor.memory_mb,
                vcpu=instance.flavor.vcpu,
                disk_path=disk_path,
                seed_iso_path=seed_iso_path,
            )
        except Exception:
            self._rollback_failed_create(instance, disk_path, seed_iso_path)
            raise

        instance.disk_path = disk_path
        instance.seed_iso_path = seed_iso_path
        instance.state = 'pending'
        instance.desired_state = 'running'
        instance.libvirt_domain_uuid = self.driver.get_domain_uuid(instance.libvirt_domain_name)
        instance.last_error = ''
        instance.save(
            update_fields=[
                'disk_path',
                'seed_iso_path',
                'state',
                'desired_state',
                'libvirt_domain_uuid',
                'last_error',
                'updated_at',
            ]
        )
        time.sleep(1)
        return self.describe_instance(instance)

    def start_instance(self, instance: ComputeInstance) -> dict:
        if instance.state == 'terminated':
            raise ComputeDriverError('Cannot start a terminated instance.')
        if instance.state == 'running':
            return self.describe_instance(instance)
        self.driver.start_domain(instance.libvirt_domain_name)
        instance.state = 'starting'
        instance.desired_state = 'running'
        instance.last_error = ''
        instance.save(update_fields=['state', 'desired_state', 'last_error', 'updated_at'])
        time.sleep(1)
        return self.describe_instance(instance)

    def stop_instance(self, instance: ComputeInstance) -> dict:
        if instance.state == 'terminated':
            return self.describe_instance(instance)
        if instance.state == 'stopped':
            return self.describe_instance(instance)
        self.driver.shutdown_domain(instance.libvirt_domain_name)
        instance.state = 'stopping'
        instance.desired_state = 'stopped'
        instance.last_error = ''
        instance.save(update_fields=['state', 'desired_state', 'last_error', 'updated_at'])

        timeout_seconds = int(getattr(settings, 'COMPUTE_STOP_TIMEOUT_SECONDS', 45))
        start = time.time()
        while time.time() - start < timeout_seconds:
            try:
                raw_state = self.driver.get_domain_state(instance.libvirt_domain_name)
            except Exception:
                break
            if self._map_libvirt_state(raw_state) == 'stopped':
                break
            time.sleep(2)
        return self.describe_instance(instance)

    def reboot_instance(self, instance: ComputeInstance) -> dict:
        if instance.state == 'terminated':
            raise ComputeDriverError('Cannot reboot a terminated instance.')
        if instance.state == 'stopped':
            return self.start_instance(instance)

        self.driver.reboot_domain(instance.libvirt_domain_name)
        instance.state = 'rebooting'
        instance.desired_state = 'running'
        instance.last_error = ''
        instance.save(update_fields=['state', 'desired_state', 'last_error', 'updated_at'])
        time.sleep(1)
        return self.describe_instance(instance)

    def terminate_instance(self, instance: ComputeInstance) -> dict:
        if instance.state == 'terminated':
            return {
                'state': 'terminated',
                'instance_id': instance.instance_id,
                'message': 'Instance already terminated',
            }

        instance.state = 'terminating'
        instance.desired_state = 'terminated'
        instance.save(update_fields=['state', 'desired_state', 'updated_at'])

        if self.driver.domain_exists(instance.libvirt_domain_name):
            self.driver.destroy_domain(instance.libvirt_domain_name)
            self.driver.undefine_domain(instance.libvirt_domain_name)

        if instance.disk_path:
            disk = Path(instance.disk_path)
            if disk.exists():
                disk.unlink()
        if instance.seed_iso_path:
            seed = Path(instance.seed_iso_path)
            if seed.exists():
                seed.unlink()

        instance.private_ip = None
        instance.public_ip = None
        instance.state = 'terminated'
        instance.cloud_init_completed = False
        instance.terminated_at = timezone.now()
        instance.last_error = ''
        instance.save(
            update_fields=[
                'private_ip',
                'public_ip',
                'state',
                'cloud_init_completed',
                'terminated_at',
                'last_error',
                'updated_at',
            ]
        )
        firewall = self._sync_instance_firewall(instance)
        return {
            'state': instance.state,
            'instance_id': instance.instance_id,
            'terminated_at': instance.terminated_at.isoformat(),
            'firewall': firewall,
        }

    def describe_instance(self, instance: ComputeInstance) -> dict:
        if instance.state == 'terminated':
            firewall = self._sync_instance_firewall(instance)
            return {
                'state': instance.state,
                'instance_id': instance.instance_id,
                'private_ip': None,
                'domain_uuid': instance.libvirt_domain_uuid,
                'firewall': firewall,
            }

        if not self.driver.domain_exists(instance.libvirt_domain_name):
            if instance.state in {'provisioning', 'pending', 'starting'}:
                return {
                    'state': instance.state,
                    'instance_id': instance.instance_id,
                    'private_ip': instance.private_ip,
                    'message': 'domain not ready yet',
                }
            instance.state = 'error'
            instance.last_error = 'libvirt domain not found for tracked instance'
            instance.save(update_fields=['state', 'last_error', 'updated_at'])
            firewall = self._sync_instance_firewall(instance)
            return {
                'state': instance.state,
                'instance_id': instance.instance_id,
                'error': instance.last_error,
                'firewall': firewall,
            }

        raw_state = self.driver.get_domain_state(instance.libvirt_domain_name)
        mapped_state = self._map_libvirt_state(raw_state)
        domain_uuid = self.driver.get_domain_uuid(instance.libvirt_domain_name)
        private_ip = self.driver.get_domain_ipv4(instance.libvirt_domain_name)

        update_fields = ['updated_at']
        if instance.state != mapped_state:
            instance.state = mapped_state
            update_fields.append('state')
        if instance.libvirt_domain_uuid != domain_uuid:
            instance.libvirt_domain_uuid = domain_uuid
            update_fields.append('libvirt_domain_uuid')
        if private_ip and instance.private_ip != private_ip:
            instance.private_ip = private_ip
            update_fields.append('private_ip')
        cloud_init_done = bool(private_ip and mapped_state == 'running')
        if instance.cloud_init_completed != cloud_init_done:
            instance.cloud_init_completed = cloud_init_done
            update_fields.append('cloud_init_completed')
        if mapped_state == 'running' and instance.launched_at is None:
            instance.launched_at = timezone.now()
            update_fields.append('launched_at')
        instance.last_error = ''
        if 'last_error' not in update_fields:
            update_fields.append('last_error')
        instance.save(update_fields=update_fields)

        firewall = self._sync_instance_firewall(instance)
        return {
            'state': instance.state,
            'instance_id': instance.instance_id,
            'private_ip': instance.private_ip,
            'domain_uuid': instance.libvirt_domain_uuid,
            'cloud_init_completed': instance.cloud_init_completed,
            'firewall': firewall,
        }
