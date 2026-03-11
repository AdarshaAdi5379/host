#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""
import atexit
import os
import subprocess
import sys


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
_worker_process: subprocess.Popen | None = None


def _should_start_compute_worker(argv: list[str]) -> bool:
    if len(argv) < 2 or argv[1] != 'runserver':
        return False
    if '--noreload' in argv:
        return True
    return os.environ.get('RUN_MAIN') == 'true'


def _launch_compute_worker() -> None:
    global _worker_process
    if _worker_process is not None and _worker_process.poll() is None:
        return
    command = [sys.executable, os.path.abspath(__file__), 'run_compute_worker', '--sleep-seconds', '1']
    try:
        _worker_process = subprocess.Popen(command, cwd=BASE_DIR)
        print('Started compute worker subprocess (pid {}).'.format(_worker_process.pid), file=sys.stderr)
    except Exception as exc:
        print(f'Failed to start compute worker: {exc}', file=sys.stderr)


def _stop_compute_worker() -> None:
    global _worker_process
    if _worker_process is None:
        return
    if _worker_process.poll() is not None:
        return
    try:
        _worker_process.terminate()
        _worker_process.wait(timeout=5)
    except Exception:
        _worker_process.kill()
    finally:
        _worker_process = None


def main():
    """Run administrative tasks."""
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
    should_start_worker = _should_start_compute_worker(sys.argv)
    if should_start_worker:
        _launch_compute_worker()
        atexit.register(_stop_compute_worker)
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    try:
        execute_from_command_line(sys.argv)
    finally:
        if should_start_worker:
            _stop_compute_worker()


if __name__ == '__main__':
    main()
