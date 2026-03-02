from __future__ import annotations

import os
import socket
import time

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from sites.gateway_manager import apply_site_gateway_config
from sites.models import GatewayApplyJob


class Command(BaseCommand):
    help = 'Run the API gateway apply worker loop.'

    def add_arguments(self, parser):
        parser.add_argument('--once', action='store_true', help='Process at most one ready job and exit.')
        parser.add_argument('--sleep-seconds', type=float, default=1.0, help='Sleep duration between polls.')

    def _claim_next_job(self, worker_id: str) -> GatewayApplyJob | None:
        now = timezone.now()

        with transaction.atomic():
            try:
                qs = GatewayApplyJob.objects.select_for_update(skip_locked=True)
            except TypeError:
                qs = GatewayApplyJob.objects.select_for_update()

            job = (
                qs
                .select_related('site')
                .filter(status='pending', scheduled_for__lte=now)
                .order_by('scheduled_for', 'created_at')
                .first()
            )
            if not job:
                return None

            # Collapse older pending jobs for the same site into this run.
            (GatewayApplyJob.objects
             .filter(site=job.site, status='pending')
             .exclude(id=job.id)
             .update(status='superseded', error='Superseded by newer queued apply.', finished_at=now))

            job.status = 'running'
            job.worker_id = worker_id
            job.started_at = now
            job.error = ''
            job.save(update_fields=['status', 'worker_id', 'started_at', 'error', 'updated_at'])
            return job

    def _finish_job(self, job_id: int, success: bool, message: str):
        now = timezone.now()
        status_value = 'success' if success else 'failed'

        GatewayApplyJob.objects.filter(id=job_id).update(
            status=status_value,
            error='' if success else message,
            finished_at=now,
            updated_at=now,
        )

    def handle(self, *args, **options):
        run_once = options['once']
        sleep_seconds = max(0.2, float(options['sleep_seconds']))

        worker_id = f"{socket.gethostname()}:{os.getpid()}"
        self.stdout.write(self.style.SUCCESS(f'Gateway worker started ({worker_id})'))

        while True:
            job = self._claim_next_job(worker_id)
            if not job:
                if run_once:
                    self.stdout.write('No pending jobs.')
                    return
                time.sleep(sleep_seconds)
                continue

            self.stdout.write(f'Applying gateway config for site={job.site.name} job_id={job.id}...')
            ok, msg = apply_site_gateway_config(job.site)
            self._finish_job(job.id, ok, msg)

            if ok:
                self.stdout.write(self.style.SUCCESS(f'Job {job.id} succeeded: {msg}'))
            else:
                self.stdout.write(self.style.ERROR(f'Job {job.id} failed: {msg}'))

            if run_once:
                return
