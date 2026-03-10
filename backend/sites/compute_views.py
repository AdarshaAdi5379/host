from __future__ import annotations

import subprocess
import tempfile
from pathlib import Path

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


def _error_response(
    message: str,
    *,
    status_code: int,
    code: str = 'compute_error',
    details: dict | None = None,
    operation_id: int | None = None,
):
    payload = {
        'code': code,
        'message': message,
        'details': details or {},
    }
    if operation_id is not None:
        payload['operation_id'] = operation_id
    return Response({'error': payload}, status=status_code)


def _operation_poll_payload(operation: ComputeOperation) -> dict:
    operation_data = ComputeOperationSerializer(operation).data
    current_status = operation_data.get('status')
    terminal = current_status in {'success', 'failed', 'superseded', 'cancelled'}
    return {
        'operation': operation_data,
        'status': current_status,
        'terminal': terminal,
        'poll_after_seconds': 0 if terminal else 2,
    }


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
            return _error_response(
                'Only admins can manage compute images.',
                status_code=status.HTTP_403_FORBIDDEN,
                code='permission_denied',
            )
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
            return _error_response(
                'Cannot delete image while it is referenced by instances.',
                status_code=status.HTTP_409_CONFLICT,
                code='conflict',
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
            return _error_response(
                'Only admins can manage compute flavors.',
                status_code=status.HTTP_403_FORBIDDEN,
                code='permission_denied',
            )
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
            return _error_response(
                'Cannot delete flavor while it is referenced by instances.',
                status_code=status.HTTP_409_CONFLICT,
                code='conflict',
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

    @action(detail=False, methods=['post'], url_path='generate')
    def generate(self, request):
        name = (request.data.get('name') or '').strip()
        if not name:
            return _error_response(
                'Key name is required.',
                status_code=status.HTTP_400_BAD_REQUEST,
                code='invalid_request',
                details={'name': ['This field is required.']},
            )

        key_type = (request.data.get('key_type') or 'ed25519').strip().lower()
        if key_type not in {'ed25519', 'rsa'}:
            return _error_response(
                'Unsupported key_type. Allowed values: ed25519, rsa.',
                status_code=status.HTTP_400_BAD_REQUEST,
                code='invalid_request',
                details={'key_type': key_type},
            )

        bits = 4096
        if key_type == 'rsa':
            try:
                bits = int(request.data.get('bits') or 4096)
            except (TypeError, ValueError):
                return _error_response(
                    'bits must be an integer.',
                    status_code=status.HTTP_400_BAD_REQUEST,
                    code='invalid_request',
                    details={'bits': request.data.get('bits')},
                )
            if bits not in {2048, 3072, 4096}:
                return _error_response(
                    'Unsupported RSA key size. Allowed values: 2048, 3072, 4096.',
                    status_code=status.HTTP_400_BAD_REQUEST,
                    code='invalid_request',
                    details={'bits': bits},
                )

        comment = (request.data.get('comment') or '').strip() or f'{request.user.username}@hostpanel'

        try:
            with tempfile.TemporaryDirectory(prefix='compute-ssh-key-') as tmp_dir:
                key_path = Path(tmp_dir) / 'id_key'
                public_path = Path(f'{key_path}.pub')

                cmd = ['ssh-keygen', '-t', key_type, '-N', '', '-C', comment, '-f', str(key_path)]
                if key_type == 'rsa':
                    cmd.extend(['-b', str(bits)])

                result = subprocess.run(cmd, check=False, capture_output=True, text=True)
                if result.returncode != 0:
                    return _error_response(
                        'Failed to generate SSH key material.',
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        code='key_generation_failed',
                        details={'stderr': (result.stderr or '').strip()},
                    )

                private_key = key_path.read_text(encoding='utf-8')
                public_key = public_path.read_text(encoding='utf-8').strip()
        except FileNotFoundError:
            return _error_response(
                'ssh-keygen binary is not available on the server.',
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                code='key_generation_failed',
            )
        except OSError as exc:
            return _error_response(
                'Failed to access generated key files.',
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                code='key_generation_failed',
                details={'error': str(exc)},
            )

        serializer = SSHKeyPairSerializer(data={'name': name, 'public_key': public_key})
        serializer.is_valid(raise_exception=True)
        key = serializer.save(owner=request.user)

        payload = {
            'status': 'created',
            'key': SSHKeyPairSerializer(key).data,
            'public_key': public_key,
            'private_key': private_key,
            'download_filename': f'{name}.pem',
            'key_type': key_type,
        }
        if key_type == 'rsa':
            payload['bits'] = bits

        response = Response(payload, status=status.HTTP_201_CREATED)
        response['Cache-Control'] = 'no-store'
        return response


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
            return _error_response(
                'You cannot delete this security group.',
                status_code=status.HTTP_403_FORBIDDEN,
                code='permission_denied',
            )
        if group.instances.exists():
            return _error_response(
                'Security group is attached to one or more instances.',
                status_code=status.HTTP_409_CONFLICT,
                code='conflict',
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['get', 'post'], url_path='rules')
    def rules(self, request, pk=None):
        group = self.get_object()
        if not _is_admin_user(request.user) and group.owner_id != request.user.id:
            return _error_response(
                'Access denied.',
                status_code=status.HTTP_403_FORBIDDEN,
                code='permission_denied',
            )

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
            return _error_response(
                'Access denied.',
                status_code=status.HTTP_403_FORBIDDEN,
                code='permission_denied',
            )

        try:
            rule = SecurityGroupRule.objects.get(id=rule_id, security_group=group)
        except SecurityGroupRule.DoesNotExist:
            return _error_response(
                'Rule not found.',
                status_code=status.HTTP_404_NOT_FOUND,
                code='not_found',
                details={'rule_id': rule_id},
            )

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
            return _error_response(
                f'Instance quota reached ({max_instances}).',
                status_code=status.HTTP_403_FORBIDDEN,
                code='quota_exceeded',
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
        return _error_response(
            'Direct update is not supported for compute instances.',
            status_code=status.HTTP_405_METHOD_NOT_ALLOWED,
            code='method_not_allowed',
        )

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        desired_state = request.data.get('desired_state')
        if desired_state not in {'running', 'stopped', 'terminated'}:
            return _error_response(
                'Only desired_state updates are allowed (running/stopped/terminated).',
                status_code=status.HTTP_400_BAD_REQUEST,
                code='invalid_request',
                details={'allowed_desired_states': ['running', 'stopped', 'terminated']},
            )
        instance.desired_state = desired_state
        instance.save(update_fields=['desired_state', 'updated_at'])
        return Response(ComputeInstanceSerializer(instance).data)

    @action(detail=True, methods=['post'], url_path='security-groups')
    def set_security_groups(self, request, pk=None):
        instance = self.get_object()
        group_ids = request.data.get('security_group_ids')
        if not isinstance(group_ids, list):
            return _error_response(
                'security_group_ids must be a list of integers.',
                status_code=status.HTTP_400_BAD_REQUEST,
                code='invalid_request',
            )
        try:
            parsed_ids = [int(v) for v in group_ids]
        except (TypeError, ValueError):
            return _error_response(
                'security_group_ids must contain valid integers.',
                status_code=status.HTTP_400_BAD_REQUEST,
                code='invalid_request',
            )

        groups = list(SecurityGroup.objects.filter(owner=instance.owner, id__in=parsed_ids))
        if len(groups) != len(set(parsed_ids)):
            return _error_response(
                'One or more security groups are invalid for this instance owner.',
                status_code=status.HTTP_400_BAD_REQUEST,
                code='invalid_request',
                details={'security_group_ids': parsed_ids},
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
        return _error_response(
            'Use terminate action to safely destroy compute instances.',
            status_code=status.HTTP_405_METHOD_NOT_ALLOWED,
            code='method_not_allowed',
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

    @action(detail=True, methods=['get'], url_path='operation-status')
    def operation_status(self, request, pk=None):
        instance = self.get_object()
        operation_id = request.query_params.get('operation_id')
        if operation_id:
            try:
                parsed_operation_id = int(operation_id)
            except (TypeError, ValueError):
                return _error_response(
                    'operation_id must be an integer.',
                    status_code=status.HTTP_400_BAD_REQUEST,
                    code='invalid_request',
                )
            op = instance.operations.filter(id=parsed_operation_id).first()
            if not op:
                return _error_response(
                    'Operation not found for this instance.',
                    status_code=status.HTTP_404_NOT_FOUND,
                    code='not_found',
                    details={'operation_id': parsed_operation_id},
                )
            return Response(_operation_poll_payload(op))

        op = latest_compute_operation(instance)
        if not op:
            return _error_response(
                'No operations found for this instance.',
                status_code=status.HTTP_404_NOT_FOUND,
                code='not_found',
            )
        return Response(_operation_poll_payload(op))

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

    @action(detail=True, methods=['get'])
    def poll(self, request, pk=None):
        operation = self.get_object()
        return Response(_operation_poll_payload(operation))


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
