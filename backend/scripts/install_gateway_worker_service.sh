#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
TEMPLATE_PATH="${BACKEND_DIR}/deploy/systemd/host-gateway-worker.service.template"

SERVICE_NAME="${SERVICE_NAME:-host-gateway-worker}"
SYSTEMD_DIR="${SYSTEMD_DIR:-/etc/systemd/system}"
RUN_AS_USER="${RUN_AS_USER:-${SUDO_USER:-${USER}}}"

detect_python_bin() {
  local candidate=""
  local backend_local_venv=""
  local project_root=""
  local project_python_version=""
  local user_home=""
  local pyenv_version_file=""
  local pyenv_version=""

  # If explicitly set, honor it.
  if [[ -n "${PYTHON_BIN:-}" ]]; then
    candidate="${PYTHON_BIN}"
  fi

  # Prefer backend virtualenv when present.
  if [[ -z "${candidate}" ]]; then
    backend_local_venv="${BACKEND_DIR}/venv/bin/python"
    if [[ -x "${backend_local_venv}" ]]; then
      candidate="${backend_local_venv}"
    fi
  fi

  # Try pyenv version pinned by project root (../.python-version).
  if [[ -z "${candidate}" ]] && [[ -n "${RUN_AS_USER}" ]]; then
    if command -v getent >/dev/null 2>&1; then
      user_home="$(getent passwd "${RUN_AS_USER}" | cut -d: -f6)"
    fi
    if [[ -z "${user_home}" ]]; then
      user_home="/home/${RUN_AS_USER}"
    fi

    project_root="$(cd "${BACKEND_DIR}/.." && pwd)"
    if [[ -f "${project_root}/.python-version" ]]; then
      project_python_version="$(head -n1 "${project_root}/.python-version" | tr -d '[:space:]')"
    elif [[ -f "${BACKEND_DIR}/.python-version" ]]; then
      project_python_version="$(head -n1 "${BACKEND_DIR}/.python-version" | tr -d '[:space:]')"
    fi

    if [[ -n "${project_python_version}" ]] && [[ -x "${user_home}/.pyenv/versions/${project_python_version}/bin/python3" ]]; then
      candidate="${user_home}/.pyenv/versions/${project_python_version}/bin/python3"
    fi
  fi

  # Try user-level pyenv global version file.
  if [[ -z "${candidate}" ]] && [[ -n "${RUN_AS_USER}" ]]; then
    if [[ -z "${user_home}" ]]; then
      if command -v getent >/dev/null 2>&1; then
        user_home="$(getent passwd "${RUN_AS_USER}" | cut -d: -f6)"
      fi
      if [[ -z "${user_home}" ]]; then
        user_home="/home/${RUN_AS_USER}"
      fi
    fi

    pyenv_version_file="${user_home}/.pyenv/version"
    if [[ -f "${pyenv_version_file}" ]]; then
      pyenv_version="$(head -n1 "${pyenv_version_file}" | tr -d '[:space:]')"
      if [[ -n "${pyenv_version}" ]] && [[ -x "${user_home}/.pyenv/versions/${pyenv_version}/bin/python3" ]]; then
        candidate="${user_home}/.pyenv/versions/${pyenv_version}/bin/python3"
      fi
    fi
  fi

  # Last attempt: resolve from runtime user shell.
  if [[ -z "${candidate}" ]] && [[ "${EUID}" -eq 0 ]] && [[ -n "${RUN_AS_USER}" ]] && command -v su >/dev/null 2>&1; then
    # Resolve interpreter from the runtime user context (important when using pyenv/venv).
    candidate="$(su - "${RUN_AS_USER}" -c 'command -v python3 || command -v python' 2>/dev/null | tail -n1 || true)"
  fi

  if [[ -z "${candidate}" ]]; then
    candidate="$(command -v python3 || command -v python || true)"
  fi

  if [[ -z "${candidate}" ]]; then
    return 1
  fi

  # Resolve pyenv shims/launchers to the real interpreter path.
  local resolved=""
  resolved="$("${candidate}" -c 'import sys; print(sys.executable)' 2>/dev/null || true)"
  if [[ -n "${resolved}" ]]; then
    echo "${resolved}"
    return 0
  fi

  readlink -f "${candidate}" 2>/dev/null || echo "${candidate}"
}

PYTHON_BIN="$(detect_python_bin || true)"

if [[ -z "${PYTHON_BIN}" ]]; then
  echo "[error] Could not find python3 or python in PATH." >&2
  exit 1
fi

if [[ ! -f "${TEMPLATE_PATH}" ]]; then
  echo "[error] Missing template: ${TEMPLATE_PATH}" >&2
  exit 1
fi

if ! command -v systemctl >/dev/null 2>&1; then
  echo "[error] systemctl not found. Use backend/scripts/gateway_worker_ctl.sh instead." >&2
  exit 1
fi

TARGET_PATH="${SYSTEMD_DIR}/${SERVICE_NAME}.service"
TMP_FILE="$(mktemp)"
trap 'rm -f "${TMP_FILE}"' EXIT

sed \
  -e "s|{{RUN_AS_USER}}|${RUN_AS_USER}|g" \
  -e "s|{{BACKEND_DIR}}|${BACKEND_DIR}|g" \
  -e "s|{{PYTHON_BIN}}|${PYTHON_BIN}|g" \
  "${TEMPLATE_PATH}" > "${TMP_FILE}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "[info] Root privileges required to install systemd unit." >&2
  echo "[info] Re-run with sudo:" >&2
  echo "  sudo SERVICE_NAME=${SERVICE_NAME} RUN_AS_USER=${RUN_AS_USER} PYTHON_BIN='${PYTHON_BIN}' ${SCRIPT_DIR}/install_gateway_worker_service.sh" >&2
  exit 1
fi

install -m 0644 "${TMP_FILE}" "${TARGET_PATH}"

systemctl daemon-reload
systemctl enable --now "${SERVICE_NAME}.service"

echo "[ok] Installed and started ${SERVICE_NAME}.service"
echo "[info] Check status: sudo systemctl status ${SERVICE_NAME}.service --no-pager"
echo "[info] Tail logs: sudo journalctl -u ${SERVICE_NAME}.service -f"
