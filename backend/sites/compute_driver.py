"""
Low-level libvirt/qemu command wrapper for compute orchestration.
"""
from __future__ import annotations

import os
import re
import shutil
import subprocess
from pathlib import Path

from django.conf import settings


class ComputeDriverError(RuntimeError):
    pass


class LibvirtComputeDriver:
    def __init__(self, network_name: str = 'default'):
        self.network_name = network_name

    @staticmethod
    def _require_binary(binary_name: str):
        if shutil.which(binary_name) is None:
            raise ComputeDriverError(f"Required binary not found: {binary_name}")

    @staticmethod
    def _find_existing_path(candidates: list[str], description: str) -> Path:
        tried: list[str] = []
        for raw_path in candidates:
            if not raw_path:
                continue
            candidate = Path(os.path.expanduser(raw_path))
            candidate_str = str(candidate)
            if candidate_str in tried:
                continue
            tried.append(candidate_str)
            if candidate.exists():
                return candidate
        raise ComputeDriverError(f"{description} not found. Tried: {', '.join(tried)}")

    def _run(self, cmd: list[str], timeout: int = 120, check: bool = True) -> str:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        stdout = (proc.stdout or '').strip()
        stderr = (proc.stderr or '').strip()
        if check and proc.returncode != 0:
            message = stderr or stdout or f"command failed with exit code {proc.returncode}"
            raise ComputeDriverError(f"{' '.join(cmd)}: {message}")
        return stdout

    def _resolve_uefi_paths(self, domain_name: str) -> tuple[str, str]:
        loader_candidates = [
            getattr(settings, 'COMPUTE_VM_UEFI_LOADER', '/usr/share/ovmf/OVMF.fd'),
            '/usr/share/ovmf/OVMF.fd',
            '/usr/share/OVMF/OVMF_CODE_4M.fd',
            '/usr/share/OVMF/OVMF_CODE.fd',
        ]
        template_candidates = [
            getattr(settings, 'COMPUTE_VM_UEFI_VARS_TEMPLATE', '/usr/share/OVMF/OVMF_VARS_4M.fd'),
            '/usr/share/OVMF/OVMF_VARS_4M.fd',
            '/usr/share/OVMF/OVMF_VARS.fd',
        ]
        loader_path = self._find_existing_path(loader_candidates, 'UEFI loader')
        template_path = self._find_existing_path(template_candidates, 'UEFI vars template')

        nvram_dir = Path(getattr(settings, 'COMPUTE_VM_UEFI_VARS_DIR', '/var/lib/libvirt/qemu/nvram'))
        nvram_dir.mkdir(parents=True, exist_ok=True)
        nvram_path = nvram_dir / f"{domain_name}_VARS.fd"
        if not nvram_path.exists():
            shutil.copy(template_path, nvram_path)
        return str(loader_path), str(nvram_path)

    def create_overlay_disk(self, base_image_path: str, disk_path: str, disk_gb: int):
        self._require_binary('qemu-img')

        base = Path(base_image_path)
        target = Path(disk_path)

        if not base.exists():
            raise ComputeDriverError(f"Base image not found: {base}")
        if target.exists():
            return

        target.parent.mkdir(parents=True, exist_ok=True)
        self._run([
            'qemu-img',
            'create',
            '-f',
            'qcow2',
            '-F',
            'qcow2',
            '-b',
            str(base),
            str(target),
            f'{int(disk_gb)}G',
        ])

    def create_cloud_init_seed(
        self,
        instance_id: str,
        vm_name: str,
        ssh_public_key: str,
        seed_iso_path: str,
        username: str = 'ubuntu',
    ):
        self._require_binary('cloud-localds')

        seed_path = Path(seed_iso_path)
        seed_path.parent.mkdir(parents=True, exist_ok=True)
        work_dir = seed_path.parent / f"{instance_id}-seed"
        work_dir.mkdir(parents=True, exist_ok=True)

        user_data_path = work_dir / 'user-data'
        meta_data_path = work_dir / 'meta-data'

        user_data = self._render_user_data(username=username, ssh_public_key=ssh_public_key)
        meta_data = self._render_meta_data(instance_id=instance_id, vm_name=vm_name)

        user_data_path.write_text(user_data, encoding='utf-8')
        meta_data_path.write_text(meta_data, encoding='utf-8')

        if seed_path.exists():
            seed_path.unlink()

        self._run([
            'cloud-localds',
            str(seed_path),
            str(user_data_path),
            str(meta_data_path),
        ])

    @staticmethod
    def _render_user_data(username: str, ssh_public_key: str) -> str:
        ssh_keys = f"\n      - {ssh_public_key.strip()}" if ssh_public_key else ''
        return (
            "#cloud-config\n"
            "users:\n"
            "  - default\n"
            f"  - name: {username}\n"
            "    sudo: ALL=(ALL) NOPASSWD:ALL\n"
            "    groups: sudo\n"
            "    shell: /bin/bash\n"
            "    lock_passwd: true\n"
            f"    ssh_authorized_keys:{ssh_keys}\n"
            "ssh_pwauth: false\n"
            "disable_root: true\n"
            "package_update: true\n"
            "package_upgrade: true\n"
            "packages:\n"
            "  - qemu-guest-agent\n"
            "runcmd:\n"
            "  - [systemctl, enable, --now, qemu-guest-agent]\n"
        )

    @staticmethod
    def _render_meta_data(instance_id: str, vm_name: str) -> str:
        return (
            f"instance-id: {instance_id}\n"
            f"local-hostname: {vm_name}\n"
        )

    def create_domain(
        self,
        domain_name: str,
        memory_mb: int,
        vcpu: int,
        disk_path: str,
        seed_iso_path: str,
    ):
        self._require_binary('virt-install')
        self._require_binary('virsh')

        if self.domain_exists(domain_name):
            return

        machine_type = getattr(settings, 'COMPUTE_VM_MACHINE_TYPE', 'pc-q35')
        virt_type = getattr(settings, 'COMPUTE_VM_VIRT_TYPE', 'kvm')
        boot_args = ['hd']
        if getattr(settings, 'COMPUTE_VM_ENABLE_UEFI', False):
            boot_args = ['uefi']

        self._run([
            'virt-install',
            '--name',
            domain_name,
            '--machine',
            machine_type,
            '--virt-type',
            virt_type,
            '--osinfo',
            'detect=on,require=off',
            '--memory',
            str(int(memory_mb)),
            '--vcpus',
            str(int(vcpu)),
            '--cpu',
            'host-model',
            '--disk',
            f'path={disk_path},format=qcow2,bus=virtio',
            '--disk',
            f'path={seed_iso_path},device=cdrom',
            '--import',
            '--graphics',
            'none',
            '--network',
            f'network={self.network_name},model=virtio',
            '--boot',
            boot_args[0],
            '--noautoconsole',
        ], timeout=300)

    def domain_exists(self, domain_name: str) -> bool:
        self._require_binary('virsh')
        proc = subprocess.run(
            ['virsh', 'dominfo', domain_name],
            capture_output=True,
            text=True,
        )
        return proc.returncode == 0

    def start_domain(self, domain_name: str):
        self._run(['virsh', 'start', domain_name], check=False)

    def shutdown_domain(self, domain_name: str):
        self._run(['virsh', 'shutdown', domain_name], check=False)

    def reboot_domain(self, domain_name: str):
        self._run(['virsh', 'reboot', domain_name], check=False)

    def destroy_domain(self, domain_name: str):
        self._run(['virsh', 'destroy', domain_name], check=False)

    def undefine_domain(self, domain_name: str):
        proc = subprocess.run(
            ['virsh', 'undefine', domain_name, '--nvram'],
            capture_output=True,
            text=True,
        )
        if proc.returncode != 0:
            self._run(['virsh', 'undefine', domain_name], check=False)

    def get_domain_state(self, domain_name: str) -> str:
        out = self._run(['virsh', 'domstate', domain_name])
        return out.strip().lower()

    def get_domain_uuid(self, domain_name: str) -> str:
        out = self._run(['virsh', 'domuuid', domain_name], check=False)
        return out.strip()

    def list_domains(self) -> list[str]:
        out = self._run(['virsh', 'list', '--all', '--name'])
        return [line.strip() for line in out.splitlines() if line.strip()]

    def get_domain_ipv4(self, domain_name: str) -> str | None:
        patterns = [
            ['virsh', 'domifaddr', domain_name, '--source', 'agent'],
            ['virsh', 'domifaddr', domain_name, '--source', 'arp'],
        ]
        regex = re.compile(r'(\d+\.\d+\.\d+\.\d+)/\d+')
        for cmd in patterns:
            out = self._run(cmd, check=False)
            if not out:
                continue
            for line in out.splitlines():
                match = regex.search(line)
                if match:
                    ip = match.group(1)
                    if not ip.startswith('169.254.'):
                        return ip
        return None
