"""
Compute operation queue helpers.
"""
from __future__ import annotations

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from .models import ComputeEvent, ComputeInstance, ComputeOperation


def record_compute_event(
    instance: ComputeInstance,
    event_type: str,
    message: str = '',
    operation: ComputeOperation | None = None,
    created_by=None,
    metadata: dict | None = None,
) -> ComputeEvent:
    return ComputeEvent.objects.create(
        instance=instance,
        operation=operation,
        event_type=event_type,
        message=message or '',
        metadata=metadata or {},
        created_by=created_by,
    )


def enqueue_compute_operation(
    instance: ComputeInstance,
    operation: str,
    requested_by=None,
    request_payload: dict | None = None,
    idempotency_key: str = '',
) -> ComputeOperation:
    """
    Queue (or coalesce) a pending compute operation for an instance.
    """
    debounce_seconds = float(getattr(settings, 'COMPUTE_OPERATION_DEBOUNCE_SECONDS', 0.2))
    schedule_time = timezone.now() + timezone.timedelta(seconds=debounce_seconds)

    normalized_payload = request_payload or {}
    normalized_key = (idempotency_key or '').strip()

    with transaction.atomic():
        if normalized_key:
            existing = (
                ComputeOperation.objects
                .select_for_update()
                .filter(
                    instance=instance,
                    operation=operation,
                    idempotency_key=normalized_key,
                )
                .exclude(status='failed')
                .order_by('-created_at')
                .first()
            )
            if existing:
                return existing

        pending = (
            ComputeOperation.objects
            .select_for_update()
            .filter(instance=instance, operation=operation, status='pending')
            .order_by('-created_at')
            .first()
        )
        if pending:
            pending.scheduled_for = max(pending.scheduled_for, schedule_time)
            if requested_by and pending.requested_by_id is None:
                pending.requested_by = requested_by
            if normalized_payload:
                pending.request_payload = normalized_payload
            if normalized_key and not pending.idempotency_key:
                pending.idempotency_key = normalized_key
            pending.save(
                update_fields=[
                    'scheduled_for',
                    'requested_by',
                    'request_payload',
                    'idempotency_key',
                    'updated_at',
                ]
            )
            return pending

        created = ComputeOperation.objects.create(
            instance=instance,
            requested_by=requested_by,
            operation=operation,
            status='pending',
            request_payload=normalized_payload,
            idempotency_key=normalized_key,
            scheduled_for=schedule_time,
        )
        record_compute_event(
            instance=instance,
            operation=created,
            created_by=requested_by,
            event_type='operation_queued',
            message=f"{operation} operation queued",
            metadata={
                'operation_id': created.id,
                'operation': operation,
            },
        )
        return created


def latest_compute_operation(instance: ComputeInstance) -> ComputeOperation | None:
    return instance.operations.order_by('-created_at').first()
