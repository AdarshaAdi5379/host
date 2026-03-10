from __future__ import annotations

import os
import socket
import time

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from sites.compute_jobs import record_compute_event
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
            # Recover stale running jobs (worker crash / hard timeout).
            operation_timeout = int(getattr(settings, 'COMPUTE_OPERATION_TIMEOUT_SECONDS', 600))
            stale_cutoff = now - timezone.timedelta(seconds=max(30, operation_timeout))
            stale_running = (
                ComputeOperation.objects
                .select_for_update()
                .filter(status='running', started_at__lt=stale_cutoff)
                .order_by('started_at')
            )
            for stale in stale_running:
                stale.status = 'pending'
                stale.scheduled_for = now + timezone.timedelta(seconds=1)
                stale.error = 'Recovered stale running operation after timeout window.'
                stale.worker_id = ''
                stale.started_at = None
                stale.save(update_fields=['status', 'scheduled_for', 'error', 'worker_id', 'started_at', 'updated_at'])

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
            job.last_attempt_at = now
            job.attempt_count = int(job.attempt_count) + 1
            job.error = ''
            job.save(update_fields=['status', 'worker_id', 'started_at', 'last_attempt_at', 'attempt_count', 'error', 'updated_at'])
            return job

    def _finish_job(self, job_id: int, success: bool, message: str, result: dict):
        now = timezone.now()
        if success:
            ComputeOperation.objects.filter(id=job_id).update(
                status='success',
                error='',
                result_payload=result or {},
                finished_at=now,
                updated_at=now,
            )
            return 'success'

        job = ComputeOperation.objects.select_related('instance').get(id=job_id)
        if job.can_retry and job.operation in {'create', 'start', 'stop', 'reboot', 'reconcile'}:
            retry_base = max(1, int(job.retry_backoff_seconds))
            # Exponential-ish backoff by attempts already consumed.
            retry_after = retry_base * (2 ** max(0, int(job.attempt_count) - 1))
            retry_after = min(retry_after, int(getattr(settings, 'COMPUTE_OPERATION_MAX_BACKOFF_SECONDS', 120)))
            job.status = 'pending'
            job.error = f"{message} (auto-retry scheduled in {retry_after}s)"
            job.result_payload = result or {}
            job.worker_id = ''
            job.started_at = None
            job.scheduled_for = now + timezone.timedelta(seconds=retry_after)
            job.save(
                update_fields=[
                    'status',
                    'error',
                    'result_payload',
                    'worker_id',
                    'started_at',
                    'scheduled_for',
                    'updated_at',
                ]
            )
            return 'retried'

        ComputeOperation.objects.filter(id=job_id).update(
            status='failed',
            error=message,
            result_payload=result or {},
            finished_at=now,
            updated_at=now,
        )
        return 'failed'

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
            record_compute_event(
                instance=job.instance,
                operation=job,
                created_by=job.requested_by,
                event_type='operation_started',
                message=f'{job.operation} started',
                metadata={
                    'operation_id': job.id,
                    'operation': job.operation,
                    'worker_id': worker_id,
                    'attempt_count': int(job.attempt_count),
                    'max_attempts': int(job.max_attempts),
                    'correlation_id': f'compute-op-{job.id}',
                },
            )
            try:
                ok, msg, result = service.execute_operation(job)
            except Exception as exc:
                ok, msg, result = False, str(exc), {}
            finish_mode = self._finish_job(job.id, ok, msg, result)

            event_type = 'operation_finished' if ok else ('operation_retry_scheduled' if finish_mode == 'retried' else 'operation_failed_final')
            record_compute_event(
                instance=job.instance,
                operation=job,
                created_by=job.requested_by,
                event_type=event_type,
                message=msg,
                metadata={
                    'operation_id': job.id,
                    'operation': job.operation,
                    'finish_mode': finish_mode,
                    'worker_id': worker_id,
                    'result': result or {},
                    'correlation_id': f'compute-op-{job.id}',
                },
            )

            if ok:
                self.stdout.write(self.style.SUCCESS(f'Job {job.id} succeeded: {msg}'))
            elif finish_mode == 'retried':
                self.stdout.write(self.style.WARNING(f'Job {job.id} will retry: {msg}'))
            else:
                self.stdout.write(self.style.ERROR(f'Job {job.id} failed: {msg}'))

            if run_once:
                return
