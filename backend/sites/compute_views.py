from __future__ import annotations

from django.db import transaction
from django.db.models import ProtectedError
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .compute_jobs import enqueue_compute_operation, latest_compute_operation
from .models import (
    ComputeEvent,
    ComputeFlavor,
    ComputeImage,
    ComputeInstance,
    ComputeOperation,
    SecurityGroup,
    SecurityGroupRule,
    SSHKeyPair,
)
from .serializers import (
    ComputeEventSerializer,
    ComputeFlavorSerializer,
    ComputeImageSerializer,
    ComputeInstanceCreateSerializer,
    ComputeInstanceSerializer,
    ComputeOperationSerializer,
    SecurityGroupRuleSerializer,
    SecurityGroupSerializer,
    SSHKeyPairSerializer,
)


def _is_admin_user(user) -> bool:
    if not user or not user.is_authenticated:
        return False
    if user.is_staff or user.is_superuser:
        return True
    return hasattr(user, 'profile') and user.profile.is_super_admin


def _queue_reconcile_for_instances(instances: list[ComputeInstance], requested_by, trigger: str, extra: dict | None = None):
    payload = {'trigger': trigger}
    if extra:
        payload.update(extra)
    queued = []
    for instance in instances:
        op = enqueue_compute_operation(
            instance=instance,
            operation='reconcile',
            requested_by=requested_by,
            request_payload=payload,
            idempotency_key='',
        )
        queued.append({'instance_id': instance.instance_id, 'operation_id': op.id, 'status': op.status})
    return queued


class ComputeImageViewSet(viewsets.ModelViewSet):
    queryset = ComputeImage.objects.all()
    serializer_class = ComputeImageSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = ComputeImage.objects.all().order_by('name', '-created_at')
        if _is_admin_user(self.request.user):
            return qs
        return qs.filter(is_active=True)

    def _require_admin(self):
        if not _is_admin_user(self.request.user):
            return Response({'error': 'Only admins can manage compute images.'}, status=status.HTTP_403_FORBIDDEN)
        return None

    def create(self, request, *args, **kwargs):
        forbidden = self._require_admin()
        if forbidden:
            return forbidden
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        forbidden = self._require_admin()
        if forbidden:
            return forbidden
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        forbidden = self._require_admin()
        if forbidden:
            return forbidden
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        forbidden = self._require_admin()
        if forbidden:
            return forbidden
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {'error': 'Cannot delete image while it is referenced by instances.'},
                status=status.HTTP_409_CONFLICT,
            )

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class ComputeFlavorViewSet(viewsets.ModelViewSet):
    queryset = ComputeFlavor.objects.all()
    serializer_class = ComputeFlavorSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = ComputeFlavor.objects.all().order_by('vcpu', 'memory_mb', 'disk_gb')
        if _is_admin_user(self.request.user):
            return qs
        return qs.filter(is_active=True)

    def _require_admin(self):
        if not _is_admin_user(self.request.user):
            return Response({'error': 'Only admins can manage compute flavors.'}, status=status.HTTP_403_FORBIDDEN)
        return None

    def create(self, request, *args, **kwargs):
        forbidden = self._require_admin()
        if forbidden:
            return forbidden
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        forbidden = self._require_admin()
        if forbidden:
            return forbidden
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        forbidden = self._require_admin()
        if forbidden:
            return forbidden
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        forbidden = self._require_admin()
        if forbidden:
            return forbidden
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {'error': 'Cannot delete flavor while it is referenced by instances.'},
                status=status.HTTP_409_CONFLICT,
            )


class SSHKeyPairViewSet(viewsets.ModelViewSet):
    queryset = SSHKeyPair.objects.all().select_related('owner')
    serializer_class = SSHKeyPairSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if _is_admin_user(self.request.user):
            return SSHKeyPair.objects.all().select_related('owner').order_by('-created_at')
        return SSHKeyPair.objects.filter(owner=self.request.user).order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)


class SecurityGroupViewSet(viewsets.ModelViewSet):
    queryset = SecurityGroup.objects.all().select_related('owner')
    serializer_class = SecurityGroupSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = SecurityGroup.objects.all().select_related('owner').prefetch_related('rules').order_by('name')
        if _is_admin_user(self.request.user):
            return qs
        return qs.filter(owner=self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    def perform_update(self, serializer):
        group = serializer.save()
        running_instances = list(group.instances.filter(state='running').order_by('id'))
        queued = _queue_reconcile_for_instances(
            running_instances,
            requested_by=self.request.user,
            trigger='security_group_updated',
            extra={'security_group_id': group.id},
        )
        self._last_reconcile_jobs = queued

    def update(self, request, *args, **kwargs):
        response = super().update(request, *args, **kwargs)
        if hasattr(self, '_last_reconcile_jobs'):
            response.data['reconcile_jobs'] = self._last_reconcile_jobs
        return response

    def partial_update(self, request, *args, **kwargs):
        response = super().partial_update(request, *args, **kwargs)
        if hasattr(self, '_last_reconcile_jobs'):
            response.data['reconcile_jobs'] = self._last_reconcile_jobs
        return response

    def destroy(self, request, *args, **kwargs):
        group = self.get_object()
        if not _is_admin_user(request.user) and group.owner_id != request.user.id:
            return Response({'error': 'You cannot delete this security group.'}, status=status.HTTP_403_FORBIDDEN)
        if group.instances.exists():
            return Response(
                {'error': 'Security group is attached to one or more instances.'},
                status=status.HTTP_409_CONFLICT,
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['get', 'post'], url_path='rules')
    def rules(self, request, pk=None):
        group = self.get_object()
        if not _is_admin_user(request.user) and group.owner_id != request.user.id:
            return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

        if request.method == 'GET':
            rules = group.rules.order_by('direction', 'protocol', 'from_port')
            return Response(SecurityGroupRuleSerializer(rules, many=True).data)

        serializer = SecurityGroupRuleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        rule = serializer.save(security_group=group)
        running_instances = list(group.instances.filter(state='running').order_by('id'))
        queued = _queue_reconcile_for_instances(
            running_instances,
            requested_by=request.user,
            trigger='security_group_rule_created',
            extra={'security_group_id': group.id, 'security_group_rule_id': rule.id},
        )
        payload = SecurityGroupRuleSerializer(rule).data
        payload['reconcile_jobs'] = queued
        return Response(payload, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['patch', 'delete'], url_path='rules/(?P<rule_id>[^/.]+)')
    def rule_detail(self, request, pk=None, rule_id=None):
        group = self.get_object()
        if not _is_admin_user(request.user) and group.owner_id != request.user.id:
            return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

        try:
            rule = SecurityGroupRule.objects.get(id=rule_id, security_group=group)
        except SecurityGroupRule.DoesNotExist:
            return Response({'error': 'Rule not found.'}, status=status.HTTP_404_NOT_FOUND)

        if request.method == 'DELETE':
            rule.delete()
            running_instances = list(group.instances.filter(state='running').order_by('id'))
            queued = _queue_reconcile_for_instances(
                running_instances,
                requested_by=request.user,
                trigger='security_group_rule_deleted',
                extra={'security_group_id': group.id, 'security_group_rule_id': int(rule_id)},
            )
            return Response({'status': 'deleted', 'reconcile_jobs': queued})

        serializer = SecurityGroupRuleSerializer(rule, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        updated = serializer.save()
        running_instances = list(group.instances.filter(state='running').order_by('id'))
        queued = _queue_reconcile_for_instances(
            running_instances,
            requested_by=request.user,
            trigger='security_group_rule_updated',
            extra={'security_group_id': group.id, 'security_group_rule_id': updated.id},
        )
        payload = SecurityGroupRuleSerializer(updated).data
        payload['reconcile_jobs'] = queued
        return Response(payload)


class ComputeInstanceViewSet(viewsets.ModelViewSet):
    queryset = ComputeInstance.objects.all().select_related('owner', 'image', 'flavor', 'ssh_key')
    serializer_class = ComputeInstanceSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = (
            ComputeInstance.objects
            .all()
            .select_related('owner', 'image', 'flavor', 'ssh_key')
            .prefetch_related('security_groups')
            .order_by('-created_at')
        )
        if _is_admin_user(self.request.user):
            return qs
        return qs.filter(owner=self.request.user)

    def get_serializer_class(self):
        if self.action == 'create':
            return ComputeInstanceCreateSerializer
        return ComputeInstanceSerializer

    @staticmethod
    def _max_instances_per_tenant(user) -> int:
        if _is_admin_user(user):
            return 0
        profile = getattr(user, 'profile', None)
        if profile and profile.project_quota > 0:
            return profile.project_quota
        return 5

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)

        max_instances = self._max_instances_per_tenant(request.user)
        current = ComputeInstance.objects.filter(owner=request.user).exclude(state='terminated').count()
        if max_instances and current >= max_instances:
            return Response(
                {'error': f'Instance quota reached ({max_instances}).'},
                status=status.HTTP_403_FORBIDDEN,
            )

        data = serializer.validated_data
        with transaction.atomic():
            instance = ComputeInstance.objects.create(
                owner=request.user,
                name=data['name'],
                image=data['image'],
                flavor=data['flavor'],
                ssh_key=data['ssh_key'],
                metadata=data.get('metadata') or {},
                state='provisioning',
                desired_state='running',
            )
            if data.get('security_groups'):
                instance.security_groups.set(data['security_groups'])

            idempotency_key = request.headers.get('X-Idempotency-Key', '').strip()
            op = enqueue_compute_operation(
                instance=instance,
                operation='create',
                requested_by=request.user,
                request_payload={},
                idempotency_key=idempotency_key,
            )

        return Response(
            {
                'status': 'queued',
                'instance': ComputeInstanceSerializer(instance).data,
                'operation': ComputeOperationSerializer(op).data,
            },
            status=status.HTTP_202_ACCEPTED,
        )

    def update(self, request, *args, **kwargs):
        return Response({'error': 'Direct update is not supported for compute instances.'}, status=status.HTTP_405_METHOD_NOT_ALLOWED)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        desired_state = request.data.get('desired_state')
        if desired_state not in {'running', 'stopped', 'terminated'}:
            return Response(
                {'error': 'Only desired_state updates are allowed (running/stopped/terminated).'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        instance.desired_state = desired_state
        instance.save(update_fields=['desired_state', 'updated_at'])
        return Response(ComputeInstanceSerializer(instance).data)

    @action(detail=True, methods=['post'], url_path='security-groups')
    def set_security_groups(self, request, pk=None):
        instance = self.get_object()
        group_ids = request.data.get('security_group_ids')
        if not isinstance(group_ids, list):
            return Response(
                {'error': 'security_group_ids must be a list of integers.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            parsed_ids = [int(v) for v in group_ids]
        except (TypeError, ValueError):
            return Response(
                {'error': 'security_group_ids must contain valid integers.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        groups = list(SecurityGroup.objects.filter(owner=instance.owner, id__in=parsed_ids))
        if len(groups) != len(set(parsed_ids)):
            return Response(
                {'error': 'One or more security groups are invalid for this instance owner.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            instance.security_groups.set(groups)
            reconcile_jobs = []
            if instance.state == 'running':
                reconcile_jobs = _queue_reconcile_for_instances(
                    [instance],
                    requested_by=request.user,
                    trigger='instance_security_groups_updated',
                    extra={'instance_id': instance.instance_id},
                )

        payload = ComputeInstanceSerializer(instance).data
        payload['reconcile_jobs'] = reconcile_jobs
        return Response(payload)

    def destroy(self, request, *args, **kwargs):
        return Response(
            {'error': 'Use terminate action to safely destroy compute instances.'},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    def _queue_lifecycle(self, request, instance: ComputeInstance, operation: str):
        idempotency_key = request.headers.get('X-Idempotency-Key', '').strip()
        op = enqueue_compute_operation(
            instance=instance,
            operation=operation,
            requested_by=request.user,
            request_payload={},
            idempotency_key=idempotency_key,
        )
        return Response(
            {
                'status': 'queued',
                'instance_id': instance.instance_id,
                'operation': ComputeOperationSerializer(op).data,
            },
            status=status.HTTP_202_ACCEPTED,
        )

    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        return self._queue_lifecycle(request, self.get_object(), 'start')

    @action(detail=True, methods=['post'])
    def stop(self, request, pk=None):
        return self._queue_lifecycle(request, self.get_object(), 'stop')

    @action(detail=True, methods=['post'])
    def reboot(self, request, pk=None):
        return self._queue_lifecycle(request, self.get_object(), 'reboot')

    @action(detail=True, methods=['post'])
    def terminate(self, request, pk=None):
        return self._queue_lifecycle(request, self.get_object(), 'terminate')

    @action(detail=True, methods=['get'])
    def describe(self, request, pk=None):
        instance = self.get_object()
        op = enqueue_compute_operation(
            instance=instance,
            operation='describe',
            requested_by=request.user,
            request_payload={},
            idempotency_key=request.headers.get('X-Idempotency-Key', '').strip(),
        )
        return Response(
            {
                'instance': ComputeInstanceSerializer(instance).data,
                'operation': ComputeOperationSerializer(op).data,
            }
        )

    @action(detail=True, methods=['get'])
    def operations(self, request, pk=None):
        instance = self.get_object()
        ops = instance.operations.order_by('-created_at')[:100]
        return Response(ComputeOperationSerializer(ops, many=True).data)

    @action(detail=True, methods=['get'], url_path='latest-operation')
    def latest_operation(self, request, pk=None):
        instance = self.get_object()
        op = latest_compute_operation(instance)
        return Response({'latest_operation': ComputeOperationSerializer(op).data if op else None})

    @action(detail=True, methods=['get'])
    def events(self, request, pk=None):
        instance = self.get_object()
        events = instance.events.order_by('-created_at')[:200]
        return Response(ComputeEventSerializer(events, many=True).data)


class ComputeOperationViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ComputeOperation.objects.all().select_related('instance', 'requested_by')
    serializer_class = ComputeOperationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = ComputeOperation.objects.all().select_related('instance', 'requested_by').order_by('-created_at')
        if _is_admin_user(self.request.user):
            return qs
        return qs.filter(instance__owner=self.request.user)


class ComputeEventViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ComputeEvent.objects.all().select_related('instance', 'operation', 'created_by')
    serializer_class = ComputeEventSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = (
            ComputeEvent.objects
            .all()
            .select_related('instance', 'operation', 'created_by')
            .order_by('-created_at')
        )
        if _is_admin_user(self.request.user):
            return qs
        return qs.filter(instance__owner=self.request.user)
