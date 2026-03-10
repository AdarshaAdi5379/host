from __future__ import annotations

import hashlib
import shutil
import tempfile
import urllib.parse
import urllib.request
from pathlib import Path

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from sites.models import ComputeImage


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open('rb') as handle:
        while True:
            chunk = handle.read(1024 * 1024)
            if not chunk:
                break
            digest.update(chunk)
    return digest.hexdigest()


def _copy_or_download_source(source: str, target_path: Path):
    parsed = urllib.parse.urlparse(source)
    scheme = parsed.scheme.lower()

    if scheme in ('http', 'https'):
        target_path.parent.mkdir(parents=True, exist_ok=True)
        with urllib.request.urlopen(source) as response, target_path.open('wb') as out:
            shutil.copyfileobj(response, out, length=1024 * 1024)
        return

    if scheme == 'file':
        source_path = Path(urllib.request.url2pathname(parsed.path))
    else:
        source_path = Path(source)

    if not source_path.exists():
        raise CommandError(f'Source image does not exist: {source_path}')

    target_path.parent.mkdir(parents=True, exist_ok=True)
    if source_path.resolve() == target_path.resolve():
        return
    shutil.copy2(source_path, target_path)


class Command(BaseCommand):
    help = 'Import a cloud image into the compute catalog with checksum verification.'

    def add_arguments(self, parser):
        parser.add_argument('--name', required=True, help='Catalog image name (e.g., ubuntu)')
        parser.add_argument('--image-version', default='latest', help='Catalog image version (e.g., 24.04)')
        parser.add_argument(
            '--source',
            required=True,
            help='Source path/URL to image file (local path, file://, http://, or https://).',
        )
        parser.add_argument(
            '--target-path',
            default='',
            help='Destination absolute path for immutable image. Default: COMPUTE_IMAGES_DIR/<name>-<version>.qcow2',
        )
        parser.add_argument('--checksum-sha256', default='', help='Expected sha256 checksum (optional)')
        parser.add_argument('--os-family', default='ubuntu', choices=[c[0] for c in ComputeImage.OS_FAMILY_CHOICES])
        parser.add_argument('--minimum-disk-gb', type=int, default=10)
        parser.add_argument('--set-default', action='store_true', help='Mark this image as default')
        parser.add_argument('--inactive', action='store_true', help='Import image but keep it inactive')
        parser.add_argument('--created-by', default='', help='Username for created_by attribution')
        parser.add_argument('--overwrite', action='store_true', help='Overwrite existing target image file')

    def handle(self, *args, **options):
        name = options['name'].strip()
        version = options['image_version'].strip() or 'latest'
        source = options['source'].strip()
        target_override = options['target_path'].strip()
        expected_checksum = (options['checksum_sha256'] or '').strip().lower()
        set_default = bool(options['set_default'])
        is_active = not bool(options['inactive'])
        os_family = options['os_family']
        minimum_disk_gb = int(options['minimum_disk_gb'])
        overwrite = bool(options['overwrite'])
        created_by_username = (options['created_by'] or '').strip()

        parsed_source = urllib.parse.urlparse(source)
        scheme = parsed_source.scheme.lower()
        if scheme in ('http', 'https'):
            source_url_value = source
        else:
            source_url_value = ''

        if set_default and not is_active:
            raise CommandError('--set-default cannot be combined with --inactive')
        if minimum_disk_gb <= 0:
            raise CommandError('--minimum-disk-gb must be greater than 0')

        if target_override:
            target_path = Path(target_override)
        else:
            images_dir = Path(getattr(settings, 'COMPUTE_IMAGES_DIR', Path(settings.BASE_DIR) / 'compute' / 'images'))
            target_path = images_dir / f'{name}-{version}.qcow2'

        if not target_path.is_absolute():
            raise CommandError('--target-path must be an absolute path')

        if target_path.exists() and not overwrite:
            raise CommandError(f'Target image already exists: {target_path}. Use --overwrite to replace it.')

        with tempfile.TemporaryDirectory(prefix='compute-image-import-') as tmpdir:
            staged_path = Path(tmpdir) / target_path.name
            self.stdout.write(f'[info] staging image from {source} -> {staged_path}')
            _copy_or_download_source(source, staged_path)

            actual_checksum = _sha256_file(staged_path)
            self.stdout.write(f'[info] sha256={actual_checksum}')

            if expected_checksum and expected_checksum != actual_checksum:
                raise CommandError(
                    f'Checksum mismatch. expected={expected_checksum} actual={actual_checksum}'
                )

            target_path.parent.mkdir(parents=True, exist_ok=True)
            if target_path.exists():
                target_path.unlink()
            shutil.move(str(staged_path), str(target_path))

        created_by = None
        if created_by_username:
            user_model = get_user_model()
            try:
                created_by = user_model.objects.get(username=created_by_username)
            except user_model.DoesNotExist as exc:
                raise CommandError(f'User not found for --created-by: {created_by_username}') from exc

        defaults = {
            'source_url': source_url_value,
            'checksum_sha256': actual_checksum,
            'local_path': str(target_path),
            'os_family': os_family,
            'minimum_disk_gb': minimum_disk_gb,
            'is_active': is_active,
            'is_default': set_default,
            'created_by': created_by,
        }

        with transaction.atomic():
            image, created = ComputeImage.objects.update_or_create(
                name=name,
                version=version,
                defaults=defaults,
            )

        verb = 'created' if created else 'updated'
        self.stdout.write(self.style.SUCCESS(f'[ok] {verb} compute image {image.name}:{image.version}'))
        self.stdout.write(f'[ok] local_path={image.local_path}')
