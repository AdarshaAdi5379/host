from __future__ import annotations

from django.core.management.base import BaseCommand

from sites.compute_driver import ComputeDriverError, LibvirtComputeDriver
from sites.compute_jobs import record_compute_event
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

    def handle(self, *args, **options):
        include_terminated = bool(options.get('include_terminated'))
        service = ComputeService()
        driver = LibvirtComputeDriver()

        qs = ComputeInstance.objects.all().order_by('id')
        if not include_terminated:
            qs = qs.exclude(state='terminated')

        total = 0
        ok_count = 0
        failed_count = 0

        for instance in qs:
            total += 1
            try:
                data = service.describe_instance(instance)
                ok_count += 1
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
        except ComputeDriverError as exc:
            self.stdout.write(self.style.WARNING(f'Could not list domains for orphan detection: {exc}'))

        self.stdout.write(
            self.style.SUCCESS(
                f"reconcile complete total={total} ok={ok_count} failed={failed_count} orphans={len(orphaned_domains)}"
            )
        )
        if orphaned_domains:
            self.stdout.write('Orphaned domains:')
            for name in orphaned_domains:
                self.stdout.write(f' - {name}')
