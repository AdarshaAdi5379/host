from __future__ import annotations

from django.core.management.base import BaseCommand, CommandError

from sites.compute_firewall import SecurityGroupFirewallManager
from sites.models import ComputeInstance


class Command(BaseCommand):
    help = 'Apply/clear compute firewall rules from SecurityGroups for instances.'

    def add_arguments(self, parser):
        parser.add_argument('--instance-id', help='Compute instance_id (i-xxxx) to sync only one instance')
        parser.add_argument('--all', action='store_true', help='Sync all instances')
        parser.add_argument('--dry-run', action='store_true', help='Print and simulate firewall commands only')

    def handle(self, *args, **options):
        instance_id = (options.get('instance_id') or '').strip()
        sync_all = bool(options.get('all'))
        dry_run = bool(options.get('dry_run'))

        if not instance_id and not sync_all:
            raise CommandError('Provide --instance-id <id> or --all')

        manager = SecurityGroupFirewallManager(dry_run=dry_run)
        qs = ComputeInstance.objects.order_by('id')
        if instance_id:
            qs = qs.filter(instance_id=instance_id)
            if not qs.exists():
                raise CommandError(f'Compute instance not found: {instance_id}')

        total = 0
        failed = 0
        for instance in qs:
            total += 1
            if instance.state == 'running' and instance.private_ip:
                result = manager.apply_instance_rules(instance)
                action = 'apply'
            else:
                result = manager.clear_instance_rules(instance)
                action = 'clear'

            if result.ok:
                self.stdout.write(
                    self.style.SUCCESS(f"[ok] {action} instance={instance.instance_id} {result.message}")
                )
            else:
                failed += 1
                self.stdout.write(
                    self.style.ERROR(f"[failed] {action} instance={instance.instance_id} {result.message}")
                )

        self.stdout.write(
            self.style.SUCCESS(
                f"sync complete total={total} failed={failed} dry_run={dry_run}"
            )
        )
