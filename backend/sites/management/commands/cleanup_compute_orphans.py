from __future__ import annotations

from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

from sites.models import ComputeInstance


class Command(BaseCommand):
    help = 'Delete orphaned compute disk/seed files that are not needed by non-terminated instances.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Only report orphan files, do not delete anything.',
        )

    @staticmethod
    def _collect_referenced_paths() -> tuple[set[Path], set[Path]]:
        disks_dir = Path(getattr(settings, 'COMPUTE_DISKS_DIR', '/var/lib/host/compute/disks')).resolve()
        seeds_dir = Path(getattr(settings, 'COMPUTE_SEEDS_DIR', '/var/lib/host/compute/seeds')).resolve()

        disk_paths: set[Path] = set()
        seed_paths: set[Path] = set()

        qs = ComputeInstance.objects.exclude(state='terminated').only('instance_id', 'disk_path', 'seed_iso_path')
        for instance in qs:
            # Preserve explicit paths stored in DB.
            if instance.disk_path:
                disk_paths.add(Path(instance.disk_path).resolve())
            if instance.seed_iso_path:
                seed_paths.add(Path(instance.seed_iso_path).resolve())

            # Also preserve canonical paths for in-flight instances that may not have persisted paths yet.
            disk_paths.add((disks_dir / f'{instance.instance_id}.qcow2').resolve())
            seed_paths.add((seeds_dir / f'{instance.instance_id}.iso').resolve())

        return disk_paths, seed_paths

    @staticmethod
    def _collect_candidates(directory: Path, pattern: str) -> list[Path]:
        if not directory.exists():
            return []
        return [p.resolve() for p in directory.glob(pattern) if p.is_file()]

    def _cleanup_group(self, label: str, candidates: list[Path], referenced: set[Path], dry_run: bool) -> tuple[int, int]:
        deleted = 0
        failed = 0
        for candidate in sorted(candidates):
            if candidate in referenced:
                continue
            if dry_run:
                self.stdout.write(f'[dry-run] orphan {label}: {candidate}')
                continue
            try:
                candidate.unlink()
                deleted += 1
                self.stdout.write(self.style.SUCCESS(f'deleted orphan {label}: {candidate}'))
            except Exception as exc:
                failed += 1
                self.stdout.write(self.style.ERROR(f'failed deleting {label} {candidate}: {exc}'))
        return deleted, failed

    def handle(self, *args, **options):
        dry_run = bool(options.get('dry_run'))

        disks_dir = Path(getattr(settings, 'COMPUTE_DISKS_DIR', '/var/lib/host/compute/disks')).resolve()
        seeds_dir = Path(getattr(settings, 'COMPUTE_SEEDS_DIR', '/var/lib/host/compute/seeds')).resolve()

        referenced_disks, referenced_seeds = self._collect_referenced_paths()
        disk_candidates = self._collect_candidates(disks_dir, '*.qcow2')
        seed_candidates = self._collect_candidates(seeds_dir, '*.iso')

        deleted_disks, failed_disks = self._cleanup_group(
            'disk',
            disk_candidates,
            referenced_disks,
            dry_run=dry_run,
        )
        deleted_seeds, failed_seeds = self._cleanup_group(
            'seed',
            seed_candidates,
            referenced_seeds,
            dry_run=dry_run,
        )

        orphan_disks = len([p for p in disk_candidates if p not in referenced_disks])
        orphan_seeds = len([p for p in seed_candidates if p not in referenced_seeds])
        mode = 'dry-run' if dry_run else 'apply'
        self.stdout.write(
            self.style.SUCCESS(
                f'cleanup_compute_orphans mode={mode} '
                f'orphan_disks={orphan_disks} orphan_seeds={orphan_seeds} '
                f'deleted_disks={deleted_disks} deleted_seeds={deleted_seeds} '
                f'failed={failed_disks + failed_seeds}'
            )
        )
