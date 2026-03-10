#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ "${EUID}" -ne 0 ]]; then
  echo "[error] This script must be run as root (sudo)." >&2
  echo "[info] Example:" >&2
  echo "  sudo ${SCRIPT_DIR}/install_platform_services.sh" >&2
  exit 1
fi

RUN_AS_USER="${RUN_AS_USER:-${SUDO_USER:-${USER}}}"
PYTHON_BIN="${PYTHON_BIN:-}"

if [[ -n "${PYTHON_BIN}" ]]; then
  SERVICE_NAME=host-django-api RUN_AS_USER="${RUN_AS_USER}" PYTHON_BIN="${PYTHON_BIN}" \
    "${SCRIPT_DIR}/install_django_api_service.sh"
  SERVICE_NAME=host-gateway-worker RUN_AS_USER="${RUN_AS_USER}" PYTHON_BIN="${PYTHON_BIN}" \
    "${SCRIPT_DIR}/install_gateway_worker_service.sh"
  SERVICE_NAME=host-compute-worker RUN_AS_USER="${RUN_AS_USER}" PYTHON_BIN="${PYTHON_BIN}" \
    "${SCRIPT_DIR}/install_compute_worker_service.sh"
else
  SERVICE_NAME=host-django-api RUN_AS_USER="${RUN_AS_USER}" \
    "${SCRIPT_DIR}/install_django_api_service.sh"
  SERVICE_NAME=host-gateway-worker RUN_AS_USER="${RUN_AS_USER}" \
    "${SCRIPT_DIR}/install_gateway_worker_service.sh"
  SERVICE_NAME=host-compute-worker RUN_AS_USER="${RUN_AS_USER}" \
    "${SCRIPT_DIR}/install_compute_worker_service.sh"
fi

echo "[ok] Platform services installed and started."
echo "[info] Verify:"
echo "  sudo systemctl status host-django-api.service --no-pager"
echo "  sudo systemctl status host-gateway-worker.service --no-pager"
echo "  sudo systemctl status host-compute-worker.service --no-pager"
