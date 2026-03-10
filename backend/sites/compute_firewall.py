"""
Security group to host firewall synchronization (Phase 3 V1).
"""
from __future__ import annotations

import ipaddress
import shutil
import subprocess
from dataclasses import dataclass

from django.conf import settings

from .models import ComputeInstance, SecurityGroupRule


@dataclass
class FirewallSyncResult:
    ok: bool
    message: str
    details: dict


class SecurityGroupFirewallManager:
    """
    Maps security-group rules to host iptables FORWARD rules for VM private IPs.
    """

    def __init__(
        self,
        enabled: bool | None = None,
        strict: bool | None = None,
        dry_run: bool | None = None,
        binary: str | None = None,
        table: str | None = None,
        parent_chain: str | None = None,
    ):
        self.enabled = bool(
            getattr(settings, 'COMPUTE_FIREWALL_ENABLED', False) if enabled is None else enabled
        )
        self.strict = bool(
            getattr(settings, 'COMPUTE_FIREWALL_STRICT', False) if strict is None else strict
        )
        self.dry_run = bool(
            getattr(settings, 'COMPUTE_FIREWALL_DRY_RUN', False) if dry_run is None else dry_run
        )
        self.binary = binary or getattr(settings, 'COMPUTE_FIREWALL_BINARY', 'iptables')
        self.table = table or getattr(settings, 'COMPUTE_FIREWALL_TABLE', 'filter')
        self.parent_chain = parent_chain or getattr(settings, 'COMPUTE_FIREWALL_PARENT_CHAIN', 'FORWARD')
        self._executed: list[str] = []

    @property
    def executed_commands(self) -> list[str]:
        return list(self._executed)

    def _run(self, args: list[str], check: bool = True) -> tuple[int, str, str]:
        cmd = [self.binary, '-w', '-t', self.table] + args
        rendered = ' '.join(cmd)
        self._executed.append(rendered)
        if self.dry_run:
            return 0, '', ''

        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
        )
        stdout = (proc.stdout or '').strip()
        stderr = (proc.stderr or '').strip()
        if check and proc.returncode != 0:
            raise RuntimeError(stderr or stdout or f"command failed ({proc.returncode}): {rendered}")
        return proc.returncode, stdout, stderr

    def _preflight(self) -> tuple[bool, str]:
        if not self.enabled:
            return False, 'compute firewall disabled'
        if shutil.which(self.binary) is None:
            return False, f'firewall binary not found: {self.binary}'
        rc, _, stderr = self._run(['-L', self.parent_chain, '-n'], check=False)
        if rc != 0:
            return False, stderr or f'failed to access {self.parent_chain} chain'
        return True, 'ready'

    @staticmethod
    def _instance_token(instance: ComputeInstance) -> str:
        cleaned = ''.join(ch for ch in instance.instance_id if ch.isalnum()).lower()[:14]
        if not cleaned:
            cleaned = str(instance.id)
        return cleaned

    def _chain_names(self, instance: ComputeInstance) -> tuple[str, str]:
        token = self._instance_token(instance)
        return f'HSGIN_{token}', f'HSGOUT_{token}'

    def _chain_exists(self, chain: str) -> bool:
        rc, _, _ = self._run(['-S', chain], check=False)
        return rc == 0

    def _ensure_chain(self, chain: str):
        if not self._chain_exists(chain):
            self._run(['-N', chain])
        self._run(['-F', chain])

    def _rule_exists(self, chain: str, rule_args: list[str]) -> bool:
        rc, _, _ = self._run(['-C', chain] + rule_args, check=False)
        return rc == 0

    def _ensure_rule(self, chain: str, rule_args: list[str], insert: bool = False, index: int = 1):
        if self._rule_exists(chain, rule_args):
            return
        if insert:
            self._run(['-I', chain, str(int(index))] + rule_args)
        else:
            self._run(['-A', chain] + rule_args)

    def _delete_rule_if_present(self, chain: str, rule_args: list[str]):
        while self._rule_exists(chain, rule_args):
            self._run(['-D', chain] + rule_args, check=False)

    def _delete_chain_if_exists(self, chain: str):
        if not self._chain_exists(chain):
            return
        self._run(['-F', chain], check=False)
        self._run(['-X', chain], check=False)

    @staticmethod
    def _validate_ipv4(value: str) -> bool:
        try:
            ip = ipaddress.ip_address(value)
            return ip.version == 4
        except ValueError:
            return False

    @staticmethod
    def _validate_cidr(cidr: str) -> bool:
        try:
            net = ipaddress.ip_network(cidr, strict=False)
            return net.version == 4
        except ValueError:
            return False

    @staticmethod
    def _ports_arg(rule: SecurityGroupRule) -> list[str]:
        if rule.protocol not in {'tcp', 'udp'}:
            return []
        if rule.from_port is None or rule.to_port is None:
            return []
        if int(rule.from_port) == int(rule.to_port):
            return ['--dport', str(int(rule.from_port))]
        return ['--dport', f'{int(rule.from_port)}:{int(rule.to_port)}']

    def _render_rule_args(self, rule: SecurityGroupRule, direction: str) -> list[str]:
        args: list[str] = []
        if rule.protocol != 'all':
            args += ['-p', rule.protocol]
        args += self._ports_arg(rule)
        if direction == 'ingress':
            args += ['-s', rule.cidr]
        else:
            args += ['-d', rule.cidr]
        args += ['-j', 'ACCEPT']
        return args

    def apply_instance_rules(self, instance: ComputeInstance) -> FirewallSyncResult:
        ready, preflight_message = self._preflight()
        if not ready:
            return FirewallSyncResult(ok=not self.strict, message=preflight_message, details={'commands': self.executed_commands})

        vm_ip = (instance.private_ip or '').strip()
        if not vm_ip:
            return FirewallSyncResult(ok=not self.strict, message='instance has no private_ip', details={'commands': self.executed_commands})
        if not self._validate_ipv4(vm_ip):
            return FirewallSyncResult(ok=not self.strict, message=f'private_ip is not IPv4: {vm_ip}', details={'commands': self.executed_commands})

        instance = (
            ComputeInstance.objects
            .select_related('owner')
            .prefetch_related('security_groups__rules')
            .get(id=instance.id)
        )

        ingress_rules: list[SecurityGroupRule] = []
        egress_rules: list[SecurityGroupRule] = []
        invalid_cidrs: list[int] = []
        for sg in instance.security_groups.all():
            for rule in sg.rules.filter(is_active=True):
                if not self._validate_cidr(rule.cidr):
                    invalid_cidrs.append(rule.id)
                    continue
                if rule.direction == 'ingress':
                    ingress_rules.append(rule)
                else:
                    egress_rules.append(rule)

        if invalid_cidrs and self.strict:
            return FirewallSyncResult(
                ok=False,
                message=f'invalid CIDR in rules: {invalid_cidrs}',
                details={'commands': self.executed_commands, 'invalid_rule_ids': invalid_cidrs},
            )

        in_chain, out_chain = self._chain_names(instance)
        try:
            self._ensure_chain(in_chain)
            self._ensure_chain(out_chain)

            # Keep return traffic/stateful flows working.
            self._ensure_rule(in_chain, ['-m', 'conntrack', '--ctstate', 'ESTABLISHED,RELATED', '-j', 'ACCEPT'])
            self._ensure_rule(out_chain, ['-m', 'conntrack', '--ctstate', 'ESTABLISHED,RELATED', '-j', 'ACCEPT'])

            for rule in ingress_rules:
                self._ensure_rule(in_chain, self._render_rule_args(rule, 'ingress'))
            for rule in egress_rules:
                self._ensure_rule(out_chain, self._render_rule_args(rule, 'egress'))

            # Deny-by-default stance once instance is mapped to SG chains.
            self._ensure_rule(in_chain, ['-j', 'DROP'])
            self._ensure_rule(out_chain, ['-j', 'DROP'])

            ingress_jump = ['-d', f'{vm_ip}/32', '-j', in_chain]
            egress_jump = ['-s', f'{vm_ip}/32', '-j', out_chain]
            self._ensure_rule(self.parent_chain, ingress_jump, insert=True, index=1)
            self._ensure_rule(self.parent_chain, egress_jump, insert=True, index=1)
        except Exception as exc:
            return FirewallSyncResult(
                ok=False if self.strict else True,
                message=f'failed to apply firewall rules: {exc}',
                details={'commands': self.executed_commands, 'instance_id': instance.instance_id},
            )

        return FirewallSyncResult(
            ok=True,
            message='firewall rules applied',
            details={
                'commands': self.executed_commands,
                'instance_id': instance.instance_id,
                'private_ip': vm_ip,
                'ingress_rules': len(ingress_rules),
                'egress_rules': len(egress_rules),
                'invalid_rule_ids': invalid_cidrs,
            },
        )

    def clear_instance_rules(self, instance: ComputeInstance) -> FirewallSyncResult:
        ready, preflight_message = self._preflight()
        if not ready:
            return FirewallSyncResult(ok=not self.strict, message=preflight_message, details={'commands': self.executed_commands})

        vm_ip = (instance.private_ip or '').strip()
        in_chain, out_chain = self._chain_names(instance)
        try:
            if vm_ip and self._validate_ipv4(vm_ip):
                self._delete_rule_if_present(self.parent_chain, ['-d', f'{vm_ip}/32', '-j', in_chain])
                self._delete_rule_if_present(self.parent_chain, ['-s', f'{vm_ip}/32', '-j', out_chain])

            self._delete_chain_if_exists(in_chain)
            self._delete_chain_if_exists(out_chain)
        except Exception as exc:
            return FirewallSyncResult(
                ok=False if self.strict else True,
                message=f'failed to clear firewall rules: {exc}',
                details={'commands': self.executed_commands, 'instance_id': instance.instance_id},
            )

        return FirewallSyncResult(
            ok=True,
            message='firewall rules cleared',
            details={'commands': self.executed_commands, 'instance_id': instance.instance_id},
        )
