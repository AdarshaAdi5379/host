#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="${SCRIPT_DIR}/backend"
BACKEND_ENV="${BACKEND_DIR}/.env"
BACKEND_ENV_EXAMPLE="${BACKEND_DIR}/.env.example"
ROOT_ENV="${SCRIPT_DIR}/.env"
BACKEND_PY="${BACKEND_DIR}/.venv/bin/python"

SKIP_SYSTEM_INSTALL=0
SKIP_FRONTEND_INSTALL=0
SKIP_SERVICE_INSTALL=0
WITH_SUPERUSER=0
DIAGNOSE_ON_ERROR=0
USE_SUDO_DOCKER=0
CURRENT_STEP="initialization"
DIAG_FILE=""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RESET='\033[0m'

info() { echo -e "${CYAN}[INFO]${RESET} $*"; }
ok() { echo -e "${GREEN}[OK]${RESET}   $*"; }
warn() { echo -e "${YELLOW}[WARN]${RESET} $*"; }

run_diagnostics() {
  local reason="${1:-error}"
  local exit_code="${2:-1}"
  local line="${3:-unknown}"
  local cmd="${4:-unknown}"

  local ts diag_dir diag_path
  ts="$(date +%Y%m%d_%H%M%S)"
  diag_dir="${SCRIPT_DIR}/logs/setup-diagnostics"
  diag_path="${diag_dir}/diagnostics_${ts}.log"
  mkdir -p "${diag_dir}"

  set +e
  trap - ERR

  {
    echo "=== HOST setup diagnostics ==="
    echo "timestamp: $(date -Iseconds)"
    echo "reason: ${reason}"
    echo "exit_code: ${exit_code}"
    echo "current_step: ${CURRENT_STEP}"
    echo "line: ${line}"
    echo "command: ${cmd}"
    echo

    echo "--- System Info ---"
    echo "user: $(id -un 2>/dev/null || true)"
    echo "uid_gid: $(id 2>/dev/null || true)"
    echo "pwd: $(pwd)"
    echo "kernel: $(uname -a 2>/dev/null || true)"
    echo

    echo "--- Resource Snapshot ---"
    df -h 2>/dev/null || true
    echo
    free -h 2>/dev/null || true
    echo

    echo "--- Tool Versions ---"
    python3 --version 2>/dev/null || true
    node --version 2>/dev/null || true
    npm --version 2>/dev/null || true
    docker --version 2>/dev/null || true
    docker compose version 2>/dev/null || true
    cloudflared --version 2>/dev/null || true
    echo

    echo "--- Git State ---"
    (cd "${SCRIPT_DIR}" && git rev-parse --abbrev-ref HEAD 2>/dev/null) || true
    (cd "${SCRIPT_DIR}" && git status --short 2>/dev/null) || true
    echo

    echo "--- Env File Keys (redacted values) ---"
    if [[ -f "${BACKEND_ENV}" ]]; then
      echo "[backend/.env keys]"
      awk -F= '/^[A-Za-z_][A-Za-z0-9_]*=/{print $1}' "${BACKEND_ENV}" | sort -u
    fi
    if [[ -f "${ROOT_ENV}" ]]; then
      echo "[.env keys]"
      awk -F= '/^[A-Za-z_][A-Za-z0-9_]*=/{print $1}' "${ROOT_ENV}" | sort -u
    fi
    echo

    echo "--- Docker State ---"
    if docker info >/dev/null 2>&1; then
      docker info 2>/dev/null || true
      docker ps -a 2>/dev/null || true
      (cd "${SCRIPT_DIR}" && docker compose --env-file backend/.env ps 2>/dev/null) || true
      (cd "${SCRIPT_DIR}" && docker compose --env-file backend/.env logs --tail=200 2>/dev/null) || true
      (cd "${BACKEND_DIR}/filebrowser" && docker compose ps 2>/dev/null) || true
      (cd "${BACKEND_DIR}/filebrowser" && docker compose logs --tail=200 2>/dev/null) || true
    elif sudo -n docker info >/dev/null 2>&1; then
      sudo -n docker info 2>/dev/null || true
      sudo -n docker ps -a 2>/dev/null || true
      (cd "${SCRIPT_DIR}" && sudo -n docker compose --env-file backend/.env ps 2>/dev/null) || true
      (cd "${SCRIPT_DIR}" && sudo -n docker compose --env-file backend/.env logs --tail=200 2>/dev/null) || true
      (cd "${BACKEND_DIR}/filebrowser" && sudo -n docker compose ps 2>/dev/null) || true
      (cd "${BACKEND_DIR}/filebrowser" && sudo -n docker compose logs --tail=200 2>/dev/null) || true
    else
      echo "Docker not accessible as current user or via passwordless sudo."
    fi
    echo

    echo "--- Systemd Service Status ---"
    if command -v systemctl >/dev/null 2>&1; then
      if sudo -n true >/dev/null 2>&1; then
        for svc in docker nginx fail2ban clamav-daemon host-django-api host-gateway-worker host-compute-worker; do
          echo "### systemctl status ${svc}"
          sudo -n systemctl status "${svc}" --no-pager 2>&1 || true
          echo
        done
        for svc in host-django-api host-gateway-worker host-compute-worker; do
          echo "### journalctl -u ${svc} (last 200)"
          sudo -n journalctl -u "${svc}" -n 200 --no-pager 2>&1 || true
          echo
        done
      else
        echo "Passwordless sudo unavailable during diagnostics; skipping privileged status/log commands."
      fi
    else
      echo "systemctl is not available on this host."
    fi
  } > "${diag_path}" 2>&1 || true

  DIAG_FILE="${diag_path}"
}

on_error() {
  local exit_code="${1:-1}"
  local line="${2:-unknown}"
  local cmd="${3:-unknown}"
  if [[ "${DIAGNOSE_ON_ERROR}" -eq 1 ]]; then
    run_diagnostics "command_failed" "${exit_code}" "${line}" "${cmd}"
    echo -e "${RED}[ERROR]${RESET} Setup failed. Diagnostics saved to: ${DIAG_FILE}" >&2
  fi
  exit "${exit_code}"
}

fail() {
  local message="$*"
  echo -e "${RED}[ERROR]${RESET} ${message}" >&2
  if [[ "${DIAGNOSE_ON_ERROR}" -eq 1 ]]; then
    run_diagnostics "manual_failure" 1 "${BASH_LINENO[0]:-unknown}" "${BASH_COMMAND:-fail}"
    echo -e "${RED}[ERROR]${RESET} Diagnostics saved to: ${DIAG_FILE}" >&2
  fi
  exit 1
}

usage() {
  cat <<'EOF'
Usage: ./setup.sh [options]

Options:
  --skip-system-install     Skip running start.sh
  --skip-frontend-install   Skip npm install
  --skip-service-install    Skip systemd service installation
  --with-superuser          Run Django createsuperuser (interactive or env-based)
  --diagnose                Collect diagnostics automatically if setup fails
  -h, --help                Show this help

Optional environment variables for non-interactive superuser creation:
  DJANGO_SUPERUSER_USERNAME
  DJANGO_SUPERUSER_PASSWORD
  DJANGO_SUPERUSER_EMAIL
EOF
}

escape_sed_replacement() {
  printf '%s' "$1" | sed -e 's/[\/&|]/\\&/g'
}

env_get() {
  local file="$1"
  local key="$2"
  grep -E "^${key}=" "$file" | tail -n1 | cut -d'=' -f2- || true
}

env_set() {
  local file="$1"
  local key="$2"
  local value="$3"
  local escaped
  escaped="$(escape_sed_replacement "$value")"
  if grep -qE "^${key}=" "$file"; then
    sed -i -E "s|^${key}=.*$|${key}=${escaped}|g" "$file"
  else
    printf '%s=%s\n' "$key" "$value" >> "$file"
  fi
}

env_ensure() {
  local file="$1"
  local key="$2"
  local value="$3"
  if ! grep -qE "^${key}=" "$file"; then
    printf '%s=%s\n' "$key" "$value" >> "$file"
  fi
}

generate_secret() {
  python3 - <<'PY'
import secrets
print(secrets.token_urlsafe(48))
PY
}

docker_info_works() {
  docker info >/dev/null 2>&1
}

sudo_docker_info_works() {
  sudo docker info >/dev/null 2>&1
}

docker_run() {
  if [[ "${USE_SUDO_DOCKER}" -eq 1 ]]; then
    sudo docker "$@"
  else
    docker "$@"
  fi
}

docker_compose_run() {
  if [[ "${USE_SUDO_DOCKER}" -eq 1 ]]; then
    sudo docker compose "$@"
  else
    docker compose "$@"
  fi
}

for arg in "$@"; do
  case "$arg" in
    --skip-system-install) SKIP_SYSTEM_INSTALL=1 ;;
    --skip-frontend-install) SKIP_FRONTEND_INSTALL=1 ;;
    --skip-service-install) SKIP_SERVICE_INSTALL=1 ;;
    --with-superuser) WITH_SUPERUSER=1 ;;
    --diagnose) DIAGNOSE_ON_ERROR=1 ;;
    -h|--help) usage; exit 0 ;;
    *) fail "Unknown option: $arg" ;;
  esac
done

if [[ "${DIAGNOSE_ON_ERROR}" -eq 1 ]]; then
  trap 'on_error $? ${LINENO} "${BASH_COMMAND}"' ERR
fi

if [[ "${EUID}" -eq 0 ]]; then
  fail "Run ./setup.sh as a regular sudo user (not root)."
fi

command -v sudo >/dev/null 2>&1 || fail "sudo is required."
command -v python3 >/dev/null 2>&1 || fail "python3 is required."

[[ -f "${SCRIPT_DIR}/start.sh" ]] || fail "Missing ${SCRIPT_DIR}/start.sh"
[[ -f "${BACKEND_ENV_EXAMPLE}" ]] || fail "Missing ${BACKEND_ENV_EXAMPLE}"
[[ -f "${SCRIPT_DIR}/docker-compose.yml" ]] || fail "Missing ${SCRIPT_DIR}/docker-compose.yml"

CURRENT_STEP="Step 1/9: Base dependency install"
info "${CURRENT_STEP}"
if [[ "${SKIP_SYSTEM_INSTALL}" -eq 0 ]]; then
  chmod +x "${SCRIPT_DIR}/start.sh"
  sudo "${SCRIPT_DIR}/start.sh"
else
  warn "Skipping start.sh (--skip-system-install)."
fi

CURRENT_STEP="Step 2/9: Python virtualenv check"
info "${CURRENT_STEP}"
if [[ ! -x "${BACKEND_PY}" ]]; then
  info "Creating backend virtualenv at ${BACKEND_DIR}/.venv"
  python3 -m venv "${BACKEND_DIR}/.venv"
  "${BACKEND_DIR}/.venv/bin/pip" install --upgrade pip
  "${BACKEND_DIR}/.venv/bin/pip" install -r "${BACKEND_DIR}/requirements.txt"
fi
ok "Python environment ready"

CURRENT_STEP="Step 3/9: Environment files"
info "${CURRENT_STEP}"
if [[ ! -f "${BACKEND_ENV}" ]]; then
  cp "${BACKEND_ENV_EXAMPLE}" "${BACKEND_ENV}"
  ok "Created backend/.env from example"
fi

if [[ ! -f "${ROOT_ENV}" ]]; then
  cat > "${ROOT_ENV}" <<'EOF'
VITE_API_BASE_URL=http://localhost:8088
VITE_GOOGLE_CLIENT_ID=
VITE_GOOGLE_REDIRECT_URI=http://localhost:5173/auth/google/callback
EOF
  ok "Created root .env"
fi

env_ensure "${ROOT_ENV}" "VITE_API_BASE_URL" "http://localhost:8088"
env_ensure "${ROOT_ENV}" "VITE_GOOGLE_CLIENT_ID" ""
env_ensure "${ROOT_ENV}" "VITE_GOOGLE_REDIRECT_URI" "http://localhost:5173/auth/google/callback"

env_set "${BACKEND_ENV}" "DEBUG" "False"
env_ensure "${BACKEND_ENV}" "ALLOWED_HOSTS" "localhost,127.0.0.1"
env_ensure "${BACKEND_ENV}" "DB_ENGINE" "postgresql"
env_ensure "${BACKEND_ENV}" "DB_NAME" "hostinger_platform"
env_ensure "${BACKEND_ENV}" "DB_USER" "hostinger_admin"
env_ensure "${BACKEND_ENV}" "DB_HOST" "localhost"
env_ensure "${BACKEND_ENV}" "DB_PORT" "5432"
env_ensure "${BACKEND_ENV}" "MINIO_ROOT_USER" "minioadmin"
env_ensure "${BACKEND_ENV}" "MINIO_STORAGE_BUCKET_NAME" "hostinger-uploads"

django_secret="$(env_get "${BACKEND_ENV}" "DJANGO_SECRET_KEY")"
if [[ -z "${django_secret}" || "${django_secret}" == "your-secret-key-here-change-in-production" ]]; then
  env_set "${BACKEND_ENV}" "DJANGO_SECRET_KEY" "$(generate_secret)"
  ok "Generated DJANGO_SECRET_KEY"
fi

db_password="$(env_get "${BACKEND_ENV}" "DB_PASSWORD")"
if [[ -z "${db_password}" || "${db_password}" == "your-secure-password-here" ]]; then
  env_set "${BACKEND_ENV}" "DB_PASSWORD" "$(generate_secret)"
  ok "Generated DB_PASSWORD"
fi

minio_password="$(env_get "${BACKEND_ENV}" "MINIO_ROOT_PASSWORD")"
if [[ -z "${minio_password}" ]]; then
  env_set "${BACKEND_ENV}" "MINIO_ROOT_PASSWORD" "$(generate_secret)"
  ok "Generated MINIO_ROOT_PASSWORD"
fi

cloudflare_creds="$(env_get "${BACKEND_ENV}" "CLOUDFLARE_CREDENTIALS_FILE")"
if [[ "${cloudflare_creds}" == /home/user/* ]]; then
  cloudflare_creds="${cloudflare_creds/\/home\/user/${HOME}}"
  env_set "${BACKEND_ENV}" "CLOUDFLARE_CREDENTIALS_FILE" "${cloudflare_creds}"
  ok "Adjusted CLOUDFLARE_CREDENTIALS_FILE to current user home"
fi

if [[ -f "${BACKEND_DIR}/cloudflared_config.yml" ]]; then
  tunnel_id="$(env_get "${BACKEND_ENV}" "CLOUDFLARE_TUNNEL_ID")"
  if [[ -n "${tunnel_id}" ]]; then
    sed -i -E "s|^tunnel:.*$|tunnel: ${tunnel_id}|g" "${BACKEND_DIR}/cloudflared_config.yml"
  fi
  cloudflare_creds="$(env_get "${BACKEND_ENV}" "CLOUDFLARE_CREDENTIALS_FILE")"
  if [[ -n "${cloudflare_creds}" ]]; then
    escaped_creds="$(escape_sed_replacement "${cloudflare_creds}")"
    sed -i -E "s|^credentials-file:.*$|credentials-file: ${escaped_creds}|g" "${BACKEND_DIR}/cloudflared_config.yml"
  fi
fi
ok "Environment configuration complete"

CURRENT_STEP="Step 4/9: Docker readiness"
info "${CURRENT_STEP}"
if docker_info_works; then
  ok "Docker usable as current user"
elif sudo_docker_info_works; then
  USE_SUDO_DOCKER=1
  warn "Docker group not active in this shell. Using sudo for Docker commands."
else
  fail "Docker is not available. Ensure start.sh completed successfully."
fi

CURRENT_STEP="Step 5/9: Start core containers"
info "${CURRENT_STEP}"
docker_run network create tenant_isolated >/dev/null 2>&1 || true
(cd "${SCRIPT_DIR}" && docker_compose_run --env-file backend/.env up -d)
(cd "${SCRIPT_DIR}" && docker_compose_run --env-file backend/.env ps)

info "Starting FileBrowser container"
(cd "${BACKEND_DIR}/filebrowser" && docker_compose_run up -d)
(cd "${BACKEND_DIR}/filebrowser" && docker_compose_run ps)
ok "Containers started"

CURRENT_STEP="Step 6/9: Frontend dependencies"
info "${CURRENT_STEP}"
if [[ "${SKIP_FRONTEND_INSTALL}" -eq 0 ]]; then
  if command -v npm >/dev/null 2>&1; then
    (cd "${SCRIPT_DIR}" && npm install --prefer-offline --loglevel warn)
    ok "npm dependencies installed"
  else
    warn "npm not found, skipping frontend dependency installation."
  fi
else
  warn "Skipping npm install (--skip-frontend-install)."
fi

CURRENT_STEP="Step 7/9: MinIO and Django initialization"
info "${CURRENT_STEP}"
(cd "${BACKEND_DIR}" && "${BACKEND_PY}" scripts/init_minio_bucket.py)
(cd "${BACKEND_DIR}" && "${BACKEND_PY}" scripts/verify_minio_upload.py)
(cd "${BACKEND_DIR}" && "${BACKEND_PY}" manage.py migrate)
(cd "${BACKEND_DIR}" && "${BACKEND_PY}" manage.py collectstatic --noinput)

if [[ "${WITH_SUPERUSER}" -eq 1 ]]; then
  if [[ -n "${DJANGO_SUPERUSER_USERNAME:-}" && -n "${DJANGO_SUPERUSER_PASSWORD:-}" && -n "${DJANGO_SUPERUSER_EMAIL:-}" ]]; then
    info "Creating Django superuser (non-interactive)"
    (
      cd "${BACKEND_DIR}" && \
      DJANGO_SUPERUSER_USERNAME="${DJANGO_SUPERUSER_USERNAME}" \
      DJANGO_SUPERUSER_PASSWORD="${DJANGO_SUPERUSER_PASSWORD}" \
      DJANGO_SUPERUSER_EMAIL="${DJANGO_SUPERUSER_EMAIL}" \
      "${BACKEND_PY}" manage.py createsuperuser --noinput || true
    )
  else
    info "Launching interactive createsuperuser"
    (cd "${BACKEND_DIR}" && "${BACKEND_PY}" manage.py createsuperuser)
  fi
else
  warn "Skipping createsuperuser. Re-run with --with-superuser when needed."
fi

(cd "${BACKEND_DIR}" && "${BACKEND_PY}" manage.py setup_filebrowser_users || true)
ok "Django setup complete"

CURRENT_STEP="Step 8/9: Install backend runtime services"
info "${CURRENT_STEP}"
if [[ "${SKIP_SERVICE_INSTALL}" -eq 0 ]]; then
  if command -v systemctl >/dev/null 2>&1; then
    (
      cd "${BACKEND_DIR}" && \
      sudo PYTHON_BIN="${BACKEND_PY}" ./scripts/install_platform_services.sh
    )
    ok "Systemd services installed"
  else
    warn "systemctl not available. Starting worker scripts as fallback."
    (cd "${BACKEND_DIR}" && ./scripts/gateway_worker_ctl.sh start || true)
    (cd "${BACKEND_DIR}" && ./scripts/compute_worker_ctl.sh start || true)
  fi
else
  warn "Skipping service install (--skip-service-install)."
fi

CURRENT_STEP="Step 9/9: Health summary"
info "${CURRENT_STEP}"
(cd "${SCRIPT_DIR}" && docker_compose_run --env-file backend/.env ps)
if command -v systemctl >/dev/null 2>&1; then
  for svc in host-django-api host-gateway-worker host-compute-worker; do
    if sudo systemctl is-active --quiet "${svc}"; then
      ok "${svc}.service is active"
    else
      warn "${svc}.service is not active (check: sudo systemctl status ${svc}.service)"
    fi
  done
fi

if command -v curl >/dev/null 2>&1; then
  curl -fsS -m 5 http://127.0.0.1:8088/api/ >/dev/null 2>&1 \
    && ok "API gateway responds on :8088" \
    || warn "API gateway check failed on :8088"
fi

ok "Setup complete."
echo
echo "Next:"
echo "1) Verify backend/.env values (domain, Cloudflare creds, optional S3 keys)."
echo "2) Start frontend when needed: npm run dev -- --host 0.0.0.0 --port 5173"
echo "3) Re-run with superuser creation: ./setup.sh --with-superuser"
