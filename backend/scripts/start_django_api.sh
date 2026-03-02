#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

PYTHON_BIN="${PYTHON_BIN:-$(command -v python3 || command -v python)}"
DJANGO_BIND_ADDR="${DJANGO_BIND_ADDR:-0.0.0.0}"
DJANGO_PORT="${DJANGO_PORT:-8000}"
DJANGO_WSGI_APP="${DJANGO_WSGI_APP:-core.wsgi:application}"
DJANGO_WORKERS="${DJANGO_WORKERS:-3}"
DJANGO_TIMEOUT="${DJANGO_TIMEOUT:-60}"
DJANGO_USE_RUNSERVER="${DJANGO_USE_RUNSERVER:-0}"

if [[ -z "${PYTHON_BIN}" ]]; then
  echo "[error] Could not find python3 or python in PATH." >&2
  exit 1
fi

cd "${BACKEND_DIR}"

if [[ "${DJANGO_USE_RUNSERVER}" == "1" ]]; then
  echo "[info] Starting Django with runserver on ${DJANGO_BIND_ADDR}:${DJANGO_PORT}" >&2
  exec "${PYTHON_BIN}" manage.py runserver "${DJANGO_BIND_ADDR}:${DJANGO_PORT}"
fi

if "${PYTHON_BIN}" -c "import gunicorn" >/dev/null 2>&1; then
  echo "[info] Starting Django with gunicorn (${DJANGO_WSGI_APP}) on ${DJANGO_BIND_ADDR}:${DJANGO_PORT}" >&2
  exec "${PYTHON_BIN}" -m gunicorn "${DJANGO_WSGI_APP}" \
    --bind "${DJANGO_BIND_ADDR}:${DJANGO_PORT}" \
    --workers "${DJANGO_WORKERS}" \
    --timeout "${DJANGO_TIMEOUT}" \
    --access-logfile - \
    --error-logfile -
fi

echo "[warn] gunicorn is not installed. Falling back to runserver." >&2
exec "${PYTHON_BIN}" manage.py runserver "${DJANGO_BIND_ADDR}:${DJANGO_PORT}"
