#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
TEMPLATE_PATH="${BACKEND_DIR}/deploy/systemd/host-compute-worker.service.template"

SERVICE_NAME="${SERVICE_NAME:-host-compute-worker}"
RUN_AS_USER="${RUN_AS_USER:-${SUDO_USER:-${USER}}}"
SYSTEMD_SCOPE="${SYSTEMD_SCOPE:-}"

detect_python_bin() {
  local candidate=""
  local backend_local_venv=""
  local project_root=""
  local project_python_version=""
  local user_home=""
  local pyenv_version_file=""
  local pyenv_version=""

  if [[ -n "${PYTHON_BIN:-}" ]]; then
    candidate="${PYTHON_BIN}"
  fi

  if [[ -z "${candidate}" ]]; then
    backend_local_venv="${BACKEND_DIR}/venv/bin/python"
    if [[ -x "${backend_local_venv}" ]]; then
      candidate="${backend_local_venv}"
    fi
  fi

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

  if [[ -z "${candidate}" ]] && [[ "${EUID}" -eq 0 ]] && [[ -n "${RUN_AS_USER}" ]] && command -v su >/dev/null 2>&1; then
    candidate="$(su - "${RUN_AS_USER}" -c 'command -v python3 || command -v python' 2>/dev/null | tail -n1 || true)"
  fi

  if [[ -z "${candidate}" ]]; then
    candidate="$(command -v python3 || command -v python || true)"
  fi

  if [[ -z "${candidate}" ]]; then
    return 1
  fi

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
  echo "[error] systemctl not found. Use backend/scripts/compute_worker_ctl.sh instead." >&2
  exit 1
fi

if [[ -z "${SYSTEMD_SCOPE}" ]]; then
  if [[ "${EUID}" -eq 0 ]]; then
    SYSTEMD_SCOPE="system"
  else
    SYSTEMD_SCOPE="user"
  fi
fi

if [[ "${SYSTEMD_SCOPE}" == "system" ]]; then
  SYSTEMD_DIR="${SYSTEMD_DIR:-/etc/systemd/system}"
  SYSTEMCTL_CMD=(systemctl)
  WANTED_BY="multi-user.target"
else
  SYSTEMD_DIR="${SYSTEMD_DIR:-${XDG_CONFIG_HOME:-${HOME}/.config}/systemd/user}"
  SYSTEMCTL_CMD=(systemctl --user)
  WANTED_BY="default.target"
fi

TARGET_PATH="${SYSTEMD_DIR}/${SERVICE_NAME}.service"
TMP_FILE="$(mktemp)"
trap 'rm -f "${TMP_FILE}"' EXIT

sed \
  -e "s|{{RUN_AS_USER}}|${RUN_AS_USER}|g" \
  -e "s|{{BACKEND_DIR}}|${BACKEND_DIR}|g" \
  -e "s|{{PYTHON_BIN}}|${PYTHON_BIN}|g" \
  "${TEMPLATE_PATH}" > "${TMP_FILE}"

if [[ "${SYSTEMD_SCOPE}" == "user" ]]; then
  python3 - "${TMP_FILE}" "${WANTED_BY}" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
wanted_by = sys.argv[2]
lines = path.read_text(encoding="utf-8").splitlines()
filtered: list[str] = []
for line in lines:
    if line.startswith(("After=", "Wants=", "Requires=")):
        continue
    if line.startswith("User="):
        continue
    if line.startswith("WantedBy="):
        filtered.append(f"WantedBy={wanted_by}")
        continue
    filtered.append(line)
path.write_text("\n".join(filtered) + "\n", encoding="utf-8")
PY
elif [[ "${EUID}" -ne 0 ]]; then
  echo "[info] Root privileges required to install systemd unit." >&2
  echo "[info] Re-run with sudo:" >&2
  echo "  sudo SERVICE_NAME=${SERVICE_NAME} RUN_AS_USER=${RUN_AS_USER} PYTHON_BIN='${PYTHON_BIN}' ${SCRIPT_DIR}/install_compute_worker_service.sh" >&2
  echo "[info] Or install a user-level service without sudo:" >&2
  echo "  SYSTEMD_SCOPE=user SERVICE_NAME=${SERVICE_NAME} RUN_AS_USER=${RUN_AS_USER} PYTHON_BIN='${PYTHON_BIN}' ${SCRIPT_DIR}/install_compute_worker_service.sh" >&2
  exit 1
fi

mkdir -p "${SYSTEMD_DIR}"
install -m 0644 "${TMP_FILE}" "${TARGET_PATH}"

"${SYSTEMCTL_CMD[@]}" daemon-reload
"${SYSTEMCTL_CMD[@]}" enable --now "${SERVICE_NAME}.service"

echo "[ok] Installed and started ${SERVICE_NAME}.service (${SYSTEMD_SCOPE})"
if [[ "${SYSTEMD_SCOPE}" == "system" ]]; then
  echo "[info] Check status: sudo systemctl status ${SERVICE_NAME}.service --no-pager"
  echo "[info] Tail logs: sudo journalctl -u ${SERVICE_NAME}.service -f"
else
  echo "[info] Check status: systemctl --user status ${SERVICE_NAME}.service --no-pager"
  echo "[info] Tail logs: journalctl --user -u ${SERVICE_NAME}.service -f"
fi
