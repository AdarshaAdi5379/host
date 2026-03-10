# Local EC2 Clone on KVM/libvirt - Complete Implementation Plan (No Coding Yet)

## 1. Purpose
Design a production-style local EC2-like platform on your laptop using KVM/libvirt, with Django as the control plane.

This document is planning-only. No implementation changes are included here.

## 2. Current Reality and Goal

### Current state
- Your backend is Docker-oriented (`WordPressSite` lifecycle, orchestration, gateway).
- No native VM orchestration layer is present yet.
- No existing EC2-like models (image/flavor/instance/security group).

### Target state
- API-driven VM lifecycle: create, start, stop, reboot, terminate.
- Tenant-aware compute instances with tracked state, IP, image, flavor, SSH key.
- Async orchestration with reconciliation and audit logs.
- Security-first defaults from day one.

## 3. Assessment of Your Manual Plan

### Correct parts
- KVM + libvirt + cloud image approach is correct.
- `virt-install --import` flow is correct for cloud images.
- Cloud-init usage is correct and required.
- Lifecycle thinking (provision, connect, destroy) is correct.

### Needed upgrades for production quality
- Replace password SSH with SSH keys only.
- Move from `cp` clone model to qcow2 backing files.
- Add retries/readiness checks (IP allocation and cloud-init completion).
- Add instance state machine and DB/libvirt reconciliation.
- Add quotas, resource scheduling constraints, and auditability.
- Add safe cleanup logic for partial failures.

## 4. Architecture Blueprint

## 4.1 Control Plane (Django)
- REST API layer for lifecycle operations.
- Job queue worker for long-running hypervisor operations.
- Scheduler/reconciler process for drift correction.
- Audit and event logging.

## 4.2 Data Plane (Host Hypervisor)
- libvirt domains (VMs), networks, storage pools.
- Golden base images + per-instance qcow2 overlays.
- Per-instance cloud-init seed ISOs.
- Tenant-oriented network segmentation model.

## 4.3 Data Model (Proposed)
- `ComputeImage`: image catalog (name, version, checksum, active).
- `ComputeFlavor`: vCPU, RAM, disk profile.
- `ComputeInstance`: owner, instance-id, state, IP, domain UUID, flavor/image refs.
- `SSHKeyPair`: owner key registry.
- `SecurityGroup` + rule entities.
- `ComputeEvent`: operation and audit timeline.

## 5. Phased Implementation Plan

## Phase 0 - Foundations (Host + Baseline)
- Verify virtualization support and KVM acceleration.
- Install and validate libvirt/qemu toolchain.
- Define host directories for images, disks, cloud-init seeds.
- Define resource policy:
  - CPU overcommit ratio
  - RAM reservation floor
  - max instances per tenant

## Phase 1 - Image Management (AMI Equivalent)
- Download canonical cloud images (Ubuntu 22.04/24.04).
- Validate checksums/signatures before enabling image.
- Store metadata in DB (source URL, hash, enabled, default flag).
- Use immutable base images.
- Create overlay disk per instance:
  - `qemu-img create -f qcow2 -F qcow2 -b <base> <instance>`

## Phase 2 - Provisioning Spec (Cloud-Init)
- Render `user-data` and `meta-data` per instance.
- Generate seed ISO via `cloud-localds`.
- Enforce SSH key login only.
- Install `qemu-guest-agent` for better guest visibility.
- Add minimal hardened default:
  - disable root login
  - disable password auth
  - package updates enabled

## Phase 3 - Networking + Security Group Model
- MVP: use libvirt NAT network for internal testing.
- V1: map AWS-like security groups to host firewall rules.
- Define ingress/egress rule evaluation model.
- Support optional host-port based public exposure.
- Persist private IP + exposure metadata in DB.

## Phase 4 - Orchestration Services
- Build service layer operations:
  - `create_instance`
  - `start_instance`
  - `stop_instance`
  - `reboot_instance`
  - `terminate_instance`
  - `describe_instance`
- Prefer `libvirt-python` for domain lifecycle.
- Use subprocess only for tools like `qemu-img` and `cloud-localds`.
- Add idempotency and per-instance operation locking.
- Add rollback/cleanup on failure.

## Phase 5 - API + Worker Integration
- Create API endpoints for all lifecycle actions.
- Offload mutating actions to async workers.
- Add operation records with job status:
  - queued -> running -> success/failed
- Return operation IDs to frontend for polling.

## Phase 6 - Reconciliation + Observability
- Periodic task compares DB desired state vs libvirt actual state.
- Detect and repair drift (zombie DB records, orphaned VM assets).
- Log every operation start/end/failure with structured context.
- Add host + VM metrics and alert thresholds.

## Phase 7 - Backup/Snapshot/Recovery
- Snapshot strategy for VM disk state.
- Scheduled backup workflow to external storage.
- Restore workflow test:
  - recover backup
  - launch replacement instance
  - verify boot and access
- DR drill schedule and checklist.

## Phase 8 - Hardening + Production Readiness
- Secrets encryption at rest for all sensitive fields.
- Strong RBAC and ownership enforcement.
- Host firewall default-deny model.
- Audit retention and incident-ready logs.
- Pen-test style validation for tenant isolation boundaries.

## 6. Detailed TODO Checklist (Execution Order)

## 6.1 Planning and Decisions
- [ ] Finalize scope for MVP vs V1 features.
- [ ] Approve naming conventions (instance IDs, domain names, storage paths).
- [ ] Approve state machine transitions and terminal states.
- [ ] Approve tenant quota policy.
- [ ] Approve CPU and memory overcommit policy.
- [ ] Approve backup retention policy.

## 6.2 Host Baseline
- [ ] Verify BIOS virtualization enabled and `kvm` modules loaded.
- [ ] Install required host packages.
- [ ] Verify `libvirtd` service health and auto-start.
- [ ] Create and permission storage directories.
- [ ] Configure log rotation and disk usage alarms.
- [ ] Document host bootstrap runbook.

## 6.3 Image Pipeline
- [ ] Build image fetch + checksum validation workflow.
- [ ] Register images in DB catalog.
- [ ] Mark a default image.
- [ ] Add image deprecation process.
- [ ] Add image cleanup (unused image pruning policy).

## 6.4 Cloud-Init Standard
- [ ] Define canonical `user-data` template.
- [ ] Define canonical `meta-data` template.
- [ ] Enforce SSH key-only access.
- [ ] Define package and hardening baseline.
- [ ] Add cloud-init completion check logic.

## 6.5 Data Model
- [ ] Define `ComputeImage` schema.
- [ ] Define `ComputeFlavor` schema.
- [ ] Define `ComputeInstance` schema.
- [ ] Define `SSHKeyPair` schema.
- [ ] Define `SecurityGroup` + rules schema.
- [ ] Define `ComputeEvent` audit schema.

## 6.6 Orchestration Services
- [ ] Design service interface for lifecycle operations.
- [ ] Add per-instance mutex/lock strategy.
- [ ] Add retry + timeout policy per operation.
- [ ] Add compensating rollback for failed provisioning.
- [ ] Add cleanup for orphaned disks/seed ISOs.

## 6.7 API and Async Jobs
- [ ] Define REST endpoints and payload schemas.
- [ ] Define async job records and status model.
- [ ] Add endpoint authz checks (owner/team/admin).
- [ ] Add operation polling endpoint.
- [ ] Add standard error contract for UI.

## 6.8 Security Model
- [ ] Define RBAC matrix for every action.
- [ ] Define tenant isolation checks.
- [ ] Define security group rule validation.
- [ ] Define secret handling/encryption approach.
- [ ] Define audit event coverage requirements.

## 6.9 Observability and Reliability
- [ ] Define structured log schema.
- [ ] Define core metrics dashboard.
- [ ] Define alert thresholds (provisioning failures, disk pressure, drift).
- [ ] Define reconciliation interval and drift SLAs.
- [ ] Define SLOs (provision success rate, median create time).

## 6.10 Backup and Recovery
- [ ] Define snapshot lifecycle policy.
- [ ] Define backup storage target and encryption.
- [ ] Define restore runbook.
- [ ] Schedule monthly restore drills.
- [ ] Define RPO/RTO targets.

## 6.11 Testing and Validation
- [ ] Unit test plan for rendering/validation/state transitions.
- [ ] Integration test plan for full VM lifecycle.
- [ ] Failure injection tests (disk full, image missing, libvirt down).
- [ ] Concurrency/race-condition tests.
- [ ] Load tests for parallel provisioning.

## 6.12 Documentation and Ops
- [ ] Write on-call runbooks for create/start/stop/terminate failures.
- [ ] Write incident response process.
- [ ] Write capacity planning guide.
- [ ] Write operator maintenance checklist.
- [ ] Write known limitations and constraints.

## 7. Safety Practices (Non-Negotiable)

## 7.1 Access and Identity
- Use SSH keys only. Do not allow password SSH in default templates.
- Do not allow root direct SSH login.
- Enforce least privilege for API actions and host operators.
- Rotate credentials and keys on defined schedule.

## 7.2 Secret Management
- Never store private keys or passwords in plaintext fields.
- Encrypt sensitive DB fields at rest.
- Redact secrets from logs and error traces.
- Avoid embedding secrets in command-line arguments when possible.

## 7.3 Host and Hypervisor Security
- Keep host packages and kernel patched.
- Limit host SSH access to trusted admin accounts.
- Use host firewall default deny; only required ports open.
- Track all privileged actions via audit logs.

## 7.4 VM Isolation and Multi-Tenancy
- Separate tenant resources logically (network and metadata boundaries).
- Prevent cross-tenant disk/image attachment.
- Validate ownership on every instance operation.
- Validate that security-group rules cannot bypass global guardrails.

## 7.5 Provisioning Safety
- Require idempotent lifecycle operations.
- Use per-instance operation lock to prevent overlapping actions.
- On failures, run deterministic cleanup to avoid zombie resources.
- Track operation correlation IDs for forensic tracing.

## 7.6 Network Safety
- Start with deny-first ingress stance.
- Restrict egress where feasible for sensitive workloads.
- Validate and sanitize all user-submitted rule inputs.
- Log and audit all rule changes.

## 7.7 Image Supply Chain Safety
- Download images only from trusted sources.
- Verify checksums/signatures before activation.
- Record image provenance and version history.
- Retire compromised/outdated images with forced block list.

## 7.8 Data Protection Safety
- Encrypt backups at rest.
- Define retention and secure deletion policies.
- Test restores regularly; backups are not valid unless proven restorable.
- Protect snapshot and backup access with strict RBAC.

## 7.9 Operational Safety
- Never execute destructive cleanup without resource ownership checks.
- Prefer graceful stop before hard destroy, except incident conditions.
- Add circuit breaker for repeated provisioning failures.
- Pause provisioning automatically when host capacity crosses critical thresholds.

## 7.10 Incident Readiness
- Maintain incident severity matrix and response playbook.
- Ensure logs/metrics cover root-cause analysis needs.
- Run tabletop exercises for major failure scenarios.
- Preserve forensic artifacts for failed operations.

## 8. Risk Register (Top Risks + Mitigations)

- Risk: VM/DB state drift.
  - Mitigation: periodic reconciler + orphan cleanup + audit events.
- Risk: credential exposure via logs.
  - Mitigation: centralized redaction + secret scanners.
- Risk: noisy-neighbor resource starvation.
  - Mitigation: quotas, cgroup limits, host capacity thresholds.
- Risk: insecure tenant network exposure.
  - Mitigation: default-deny rules + rule validation + change audits.
- Risk: failed recoveries during incident.
  - Mitigation: mandatory scheduled restore drills.

## 9. Definition of Done for Planning Review
- [ ] Scope and phases approved.
- [ ] TODO checklist approved.
- [ ] Safety practices accepted as baseline policy.
- [ ] MVP success criteria approved.
- [ ] Go/no-go decision recorded before coding starts.

## 10. Suggested MVP Success Criteria
- 95%+ successful create/start/stop/terminate operations in test runs.
- Median provision time under agreed threshold (example: <120 seconds).
- Zero cross-tenant access violations in validation tests.
- Reconciler detects and resolves drift within defined SLA.

