from __future__ import annotations

import os
import socket
import time

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from sites.compute_service import ComputeService
from sites.models import ComputeInstance, ComputeOperation


class Command(BaseCommand):
    help = 'Run the compute operation worker loop.'

    def add_arguments(self, parser):
        parser.add_argument('--once', action='store_true', help='Process at most one ready job and exit.')
        parser.add_argument('--sleep-seconds', type=float, default=1.0, help='Sleep duration between polls.')

    def _claim_next_job(self, worker_id: str) -> ComputeOperation | None:
        now = timezone.now()

        with transaction.atomic():
            try:
                qs = ComputeOperation.objects.select_for_update(skip_locked=True)
            except TypeError:
                qs = ComputeOperation.objects.select_for_update()

            job = (
                qs
                .select_related('instance')
                .filter(status='pending', scheduled_for__lte=now)
                .order_by('scheduled_for', 'created_at')
                .first()
            )
            if not job:
                return None

            # Per-instance lock: if another operation is running, push this one slightly and retry later.
            running_exists = (
                ComputeOperation.objects
                .filter(instance=job.instance, status='running')
                .exclude(id=job.id)
                .exists()
            )
            if running_exists:
                job.scheduled_for = now + timezone.timedelta(seconds=2)
                job.save(update_fields=['scheduled_for', 'updated_at'])
                return None

            try:
                lock_qs = ComputeInstance.objects.select_for_update(skip_locked=True)
            except TypeError:
                lock_qs = ComputeInstance.objects.select_for_update()
            locked = lock_qs.filter(id=job.instance_id).first()
            if not locked:
                job.scheduled_for = now + timezone.timedelta(seconds=2)
                job.save(update_fields=['scheduled_for', 'updated_at'])
                return None

            # Collapse older pending jobs of the same operation for this instance into this run.
            (
                ComputeOperation.objects
                .filter(instance=job.instance, operation=job.operation, status='pending')
                .exclude(id=job.id)
                .update(
                    status='superseded',
                    error='Superseded by newer queued operation.',
                    finished_at=now,
                    updated_at=now,
                )
            )

            job.status = 'running'
            job.worker_id = worker_id
            job.started_at = now
            job.error = ''
            job.save(update_fields=['status', 'worker_id', 'started_at', 'error', 'updated_at'])
            return job

    def _finish_job(self, job_id: int, success: bool, message: str, result: dict):
        now = timezone.now()
        status_value = 'success' if success else 'failed'

        ComputeOperation.objects.filter(id=job_id).update(
            status=status_value,
            error='' if success else message,
            result_payload=result or {},
            finished_at=now,
            updated_at=now,
        )

    def handle(self, *args, **options):
        run_once = options['once']
        sleep_seconds = max(0.2, float(options['sleep_seconds']))

        worker_id = f"{socket.gethostname()}:{os.getpid()}"
        self.stdout.write(self.style.SUCCESS(f'Compute worker started ({worker_id})'))
        service = ComputeService()

        while True:
            job = self._claim_next_job(worker_id)
            if not job:
                if run_once:
                    self.stdout.write('No pending compute operations.')
                    return
                time.sleep(sleep_seconds)
                continue

            self.stdout.write(
                f"Executing operation={job.operation} instance={job.instance.instance_id} job_id={job.id}..."
            )
            ok, msg, result = service.execute_operation(job)
            self._finish_job(job.id, ok, msg, result)

            if ok:
                self.stdout.write(self.style.SUCCESS(f'Job {job.id} succeeded: {msg}'))
            else:
                self.stdout.write(self.style.ERROR(f'Job {job.id} failed: {msg}'))

            if run_once:
                return
