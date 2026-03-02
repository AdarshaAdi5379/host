"""
Gateway apply job queue helpers.
"""
from __future__ import annotations

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from .models import GatewayApplyJob, WordPressSite


def enqueue_gateway_apply(
    site: WordPressSite,
    requested_by=None,
    reason: str = '',
) -> GatewayApplyJob:
    """
    Queue (or coalesce) a pending gateway apply job for the site.
    """
    debounce_seconds = float(getattr(settings, 'GATEWAY_RELOAD_DEBOUNCE_SECONDS', 0.5))
    schedule_time = timezone.now() + timezone.timedelta(seconds=debounce_seconds)

    with transaction.atomic():
        pending_job = (
            GatewayApplyJob.objects
            .select_for_update()
            .filter(site=site, status='pending')
            .order_by('-created_at')
            .first()
        )

        if pending_job:
            pending_job.scheduled_for = max(pending_job.scheduled_for, schedule_time)
            if requested_by and pending_job.requested_by_id is None:
                pending_job.requested_by = requested_by
            if reason:
                pending_job.reason = reason
            pending_job.save(update_fields=['scheduled_for', 'requested_by', 'reason', 'updated_at'])
            return pending_job

        return GatewayApplyJob.objects.create(
            site=site,
            requested_by=requested_by,
            reason=reason,
            scheduled_for=schedule_time,
            status='pending',
        )


def latest_gateway_job(site: WordPressSite) -> GatewayApplyJob | None:
    return site.gateway_apply_jobs.order_by('-created_at').first()
