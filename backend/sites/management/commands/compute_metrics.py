from __future__ import annotations

import json
import os
import shutil
import statistics
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db.models import Count
from django.utils import timezone

from sites.models import ComputeInstance, ComputeOperation


class Command(BaseCommand):
    help = 'Emit compute observability metrics (instances, operations, queue health, and alerts).'

    def add_arguments(self, parser):
        parser.add_argument(
            '--window-hours',
            type=float,
            default=24.0,
            help='Metrics aggregation window in hours for operation statistics.',
        )
        parser.add_argument(
            '--pretty',
            action='store_true',
            help='Pretty-print JSON output.',
        )

    @staticmethod
    def _group_counts(queryset, field: str) -> dict:
        rows = queryset.values(field).annotate(count=Count('id')).order_by(field)
        return {row[field]: row['count'] for row in rows}

    @staticmethod
    def _storage_metrics() -> dict:
        root = Path(getattr(settings, 'COMPUTE_STORAGE_ROOT', '')).resolve()
        payload = {'path': str(root), 'exists': root.exists()}
        if not root.exists():
            return payload
        usage = shutil.disk_usage(root)
        payload.update(
            {
                'total_bytes': usage.total,
                'used_bytes': usage.used,
                'free_bytes': usage.free,
                'used_percent': round((usage.used / usage.total) * 100, 2) if usage.total else 0.0,
            }
        )
        return payload

    @staticmethod
    def _load_average() -> dict:
        try:
            load1, load5, load15 = os.getloadavg()
            return {'one_min': round(load1, 3), 'five_min': round(load5, 3), 'fifteen_min': round(load15, 3)}
        except OSError:
            return {'unsupported': True}

    def handle(self, *args, **options):
        window_hours = max(1.0, float(options.get('window_hours') or 24.0))
        pretty = bool(options.get('pretty'))
        now = timezone.now()
        window_start = now - timezone.timedelta(hours=window_hours)

        instance_states = self._group_counts(ComputeInstance.objects.all(), 'state')
        operation_window_qs = ComputeOperation.objects.filter(created_at__gte=window_start)
        operation_status = self._group_counts(operation_window_qs, 'status')
        operation_types = self._group_counts(operation_window_qs, 'operation')

        success_count = operation_status.get('success', 0)
        failed_count = operation_status.get('failed', 0)
        completed_count = success_count + failed_count
        failure_rate = round((failed_count / completed_count), 4) if completed_count else None

        create_durations = []
        for op in (
            ComputeOperation.objects
            .filter(operation='create', status='success', finished_at__isnull=False, started_at__isnull=False, finished_at__gte=window_start)
            .only('started_at', 'finished_at')
        ):
            duration = (op.finished_at - op.started_at).total_seconds()
            if duration >= 0:
                create_durations.append(duration)

        create_stats = {
            'count': len(create_durations),
            'median_seconds': round(statistics.median(create_durations), 3) if create_durations else None,
            'max_seconds': round(max(create_durations), 3) if create_durations else None,
        }

        queue_pending_total = ComputeOperation.objects.filter(status='pending').count()
        queue_pending_ready = ComputeOperation.objects.filter(status='pending', scheduled_for__lte=now).count()
        queue_running = ComputeOperation.objects.filter(status='running').count()

        alerts = []
        queue_threshold = int(getattr(settings, 'COMPUTE_ALERT_MAX_QUEUE_DEPTH', 50))
        failure_threshold = float(getattr(settings, 'COMPUTE_ALERT_MAX_FAILURE_RATE', 0.2))
        disk_threshold = float(getattr(settings, 'COMPUTE_ALERT_MAX_DISK_USAGE_PCT', 85))

        if queue_pending_ready > queue_threshold:
            alerts.append(
                {
                    'code': 'queue_depth_high',
                    'severity': 'warning',
                    'message': f'Pending-ready queue depth {queue_pending_ready} exceeds threshold {queue_threshold}.',
                }
            )
        if failure_rate is not None and failure_rate > failure_threshold:
            alerts.append(
                {
                    'code': 'failure_rate_high',
                    'severity': 'warning',
                    'message': f'Failure rate {failure_rate:.2%} exceeds threshold {failure_threshold:.2%}.',
                }
            )

        storage = self._storage_metrics()
        if storage.get('exists') and storage.get('used_percent') is not None and storage['used_percent'] > disk_threshold:
            alerts.append(
                {
                    'code': 'disk_usage_high',
                    'severity': 'critical',
                    'message': f"Compute storage usage {storage['used_percent']:.2f}% exceeds threshold {disk_threshold:.2f}%.",
                }
            )

        payload = {
            'generated_at': now.isoformat(),
            'window_hours': window_hours,
            'instances': {
                'total': sum(instance_states.values()),
                'by_state': instance_states,
            },
            'operations': {
                'window_started_at': window_start.isoformat(),
                'total': operation_window_qs.count(),
                'by_status': operation_status,
                'by_operation': operation_types,
                'completed_count': completed_count,
                'failure_rate': failure_rate,
                'create_duration': create_stats,
            },
            'queue': {
                'pending_total': queue_pending_total,
                'pending_ready': queue_pending_ready,
                'running': queue_running,
            },
            'host': {
                'load_avg': self._load_average(),
                'storage': storage,
            },
            'alerts': alerts,
        }

        if pretty:
            self.stdout.write(json.dumps(payload, indent=2, sort_keys=True))
        else:
            self.stdout.write(json.dumps(payload, sort_keys=True))
