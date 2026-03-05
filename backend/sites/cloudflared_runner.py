"""
cloudflared_runner.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Manages the cloudflared tunnel process alongside Django.

When Django starts (via AppConfig.ready), this module:
  1. Looks up the config path from Django settings.
  2. Spawns  `cloudflared tunnel --config <path> run`  in a
     background daemon thread that auto-restarts on crash.
  3. Registers an atexit handler to stop the tunnel cleanly
     when Django shuts down.

No manual intervention needed — the tunnel stays alive as
long as the Django process is running.
"""

import atexit
import logging
import os
import shutil
import subprocess
import threading
import time

logger = logging.getLogger(__name__)

# ── Internal state ────────────────────────────────────────
_process: subprocess.Popen | None = None
_stop_event = threading.Event()
_lock = threading.Lock()

# How long to wait before restarting a crashed cloudflared
RESTART_DELAY_SECONDS = 5


def _find_cloudflared() -> str | None:
    """Return the absolute path of the cloudflared binary, or None."""
    return shutil.which("cloudflared")


def _run_loop(config_path: str, cloudflared_bin: str) -> None:
    """
    Background daemon thread that keeps cloudflared alive.
    Restarts automatically after crashes until _stop_event is set.
    """
    global _process

    while not _stop_event.is_set():
        cmd = [cloudflared_bin, "tunnel", "--config", config_path, "run"]
        logger.info("[cloudflared] Starting: %s", " ".join(cmd))

        try:
            with _lock:
                _process = subprocess.Popen(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                )

            # Stream output to Django logger
            assert _process.stdout is not None
            for line in _process.stdout:
                line = line.rstrip()
                if line:
                    logger.debug("[cloudflared] %s", line)

            _process.wait()
            exit_code = _process.returncode

        except FileNotFoundError:
            logger.error(
                "[cloudflared] Binary not found at '%s'. "
                "Install cloudflared and ensure it is in PATH.",
                cloudflared_bin,
            )
            return  # No point retrying if the binary is missing
        except Exception as exc:
            logger.warning("[cloudflared] Unexpected error: %s", exc)
            exit_code = -1

        if _stop_event.is_set():
            break

        logger.warning(
            "[cloudflared] Exited with code %d — restarting in %ds …",
            exit_code,
            RESTART_DELAY_SECONDS,
        )
        _stop_event.wait(timeout=RESTART_DELAY_SECONDS)


def _shutdown() -> None:
    """atexit handler — terminate cloudflared when Django exits."""
    global _process
    _stop_event.set()

    with _lock:
        proc = _process

    if proc and proc.poll() is None:
        logger.info("[cloudflared] Stopping tunnel (Django shutdown) …")
        try:
            proc.terminate()
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()
        except Exception:
            pass
    logger.info("[cloudflared] Tunnel stopped.")


def start(config_path: str) -> None:
    """
    Launch cloudflared in a background thread.

    Call this once from AppConfig.ready().
    Subsequent calls are no-ops (idempotent).
    """
    # Skip in management commands that don't serve HTTP,
    # and avoid double-start in Django's auto-reloader child process.
    # RUN_MAIN is set by Django's reloader in the *child* process only;
    # we want to start there (where the real server lives).
    run_main: str | None = os.environ.get("RUN_MAIN")    # None  → first fork
    is_reloader_parent = run_main is None and "runserver" in " ".join(
        __import__("sys").argv
    )
    if is_reloader_parent:
        # Parent process of the auto-reloader — don't start here.
        return

    if not os.path.isfile(config_path):
        logger.warning(
            "[cloudflared] Config not found at '%s'. Tunnel will NOT start.",
            config_path,
        )
        return

    cloudflared_bin = _find_cloudflared()
    if cloudflared_bin is None:
        logger.warning(
            "[cloudflared] 'cloudflared' binary not in PATH. "
            "Install it with: curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o /tmp/cf.deb && sudo dpkg -i /tmp/cf.deb"
        )
        return

    logger.info(
        "[cloudflared] Starting tunnel with config: %s", config_path
    )

    atexit.register(_shutdown)

    thread = threading.Thread(
        target=_run_loop,
        args=(config_path, cloudflared_bin),
        daemon=True,
        name="cloudflared-tunnel",
    )
    thread.start()
