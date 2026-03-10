from __future__ import annotations

import json

from django.core.management.base import BaseCommand

from sites.compute_driver import ComputeDriverError, LibvirtComputeDriver
from sites.compute_jobs import enqueue_compute_operation, record_compute_event
from sites.compute_service import ComputeService
from sites.models import ComputeInstance


class Command(BaseCommand):
    help = 'Reconcile compute instances between DB desired state and libvirt actual state.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--include-terminated',
            action='store_true',
            help='Also reconcile instances already marked terminated.',
        )
        parser.add_argument(
            '--repair-drift',
            action='store_true',
            help='Queue lifecycle operations when desired state drifts from actual state.',
        )
        parser.add_argument(
            '--json',
            action='store_true',
            help='Print final summary as JSON.',
        )

    @staticmethod
    def _repair_operation_for_drift(desired_state: str, actual_state: str) -> str:
        desired = (desired_state or '').lower()
        actual = (actual_state or '').lower()
        if desired == 'running' and actual in {'stopped', 'error'}:
            return 'start'
        if desired == 'stopped' and actual == 'running':
            return 'stop'
        if desired == 'terminated' and actual != 'terminated':
            return 'terminate'
        return 'reconcile'

    def handle(self, *args, **options):
        include_terminated = bool(options.get('include_terminated'))
        repair_drift = bool(options.get('repair_drift'))
        output_json = bool(options.get('json'))
        service = ComputeService()
        driver = LibvirtComputeDriver()

        qs = ComputeInstance.objects.all().order_by('id')
        if not include_terminated:
            qs = qs.exclude(state='terminated')

        total = 0
        ok_count = 0
        failed_count = 0
        drift_count = 0
        repair_queued = 0

        for instance in qs:
            total += 1
            try:
                data = service.describe_instance(instance)
                ok_count += 1
                actual_state = (data or {}).get('state') or instance.state
                desired_state = instance.desired_state

                if desired_state and actual_state and desired_state != actual_state:
                    drift_count += 1
                    drift_metadata = {
                        'instance_id': instance.instance_id,
                        'desired_state': desired_state,
                        'actual_state': actual_state,
                    }
                    record_compute_event(
                        instance=instance,
                        event_type='drift_detected',
                        message='Desired state differs from actual state.',
                        metadata=drift_metadata,
                    )
                    self.stdout.write(
                        self.style.WARNING(
                            f"[drift] {instance.instance_id} desired={desired_state} actual={actual_state}"
                        )
                    )
                    if repair_drift:
                        repair_operation = self._repair_operation_for_drift(desired_state, actual_state)
                        queued = enqueue_compute_operation(
                            instance=instance,
                            operation=repair_operation,
                            request_payload={
                                'trigger': 'drift_detected',
                                'desired_state': desired_state,
                                'actual_state': actual_state,
                            },
                            idempotency_key='',
                        )
                        repair_queued += 1
                        record_compute_event(
                            instance=instance,
                            operation=queued,
                            event_type='drift_repair_queued',
                            message=f'Queued {repair_operation} for drift repair.',
                            metadata={
                                **drift_metadata,
                                'repair_operation': repair_operation,
                                'repair_operation_id': queued.id,
                            },
                        )
                self.stdout.write(
                    self.style.SUCCESS(
                        f"[ok] {instance.instance_id} state={data.get('state')} ip={data.get('private_ip')}"
                    )
                )
            except Exception as exc:
                failed_count += 1
                record_compute_event(
                    instance=instance,
                    event_type='reconcile_failed',
                    message='Reconcile failed',
                    metadata={'error': str(exc)},
                )
                self.stdout.write(
                    self.style.ERROR(f"[failed] {instance.instance_id} error={exc}")
                )

        orphaned_domains = []
        try:
            domains = set(driver.list_domains())
            tracked = set(
                ComputeInstance.objects.exclude(libvirt_domain_name='').values_list('libvirt_domain_name', flat=True)
            )
            orphaned_domains = sorted(domains - tracked)
        except (ComputeDriverError, OSError, FileNotFoundError) as exc:
            self.stdout.write(self.style.WARNING(f'Could not list domains for orphan detection: {exc}'))

        summary = {
            'total': total,
            'ok': ok_count,
            'failed': failed_count,
            'drift_detected': drift_count,
            'drift_repair_queued': repair_queued,
            'orphans': len(orphaned_domains),
            'orphaned_domains': orphaned_domains,
        }
        self.stdout.write(
            self.style.SUCCESS(
                f"reconcile complete total={total} ok={ok_count} failed={failed_count} "
                f"drift={drift_count} repairs={repair_queued} orphans={len(orphaned_domains)}"
            )
        )
        if orphaned_domains:
            self.stdout.write('Orphaned domains:')
            for name in orphaned_domains:
                self.stdout.write(f' - {name}')
        if output_json:
            self.stdout.write(json.dumps(summary, sort_keys=True))
