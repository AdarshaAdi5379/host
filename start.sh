#!/usr/bin/env bash
# =============================================================================
#  HOST Platform — Dependency Setup Script
#  Run once on a fresh Linux server to install every required dependency.
#
#  Usage:
#    chmod +x start.sh
#    sudo ./start.sh
#
#  What this script installs:
#    1. System packages     — curl, git, build tools, libpq-dev, libmysqlclient-dev
#    2. Security tooling     — fail2ban, unattended-upgrades, apt-listchanges, ufw
#    3. Docker Engine       — with Docker Compose plugin (v2)
#    4. Nginx               — host-level reverse proxy
#    5. Node.js 20 LTS      — for the React/Vite frontend
#    6. Python 3 + pip      — for the Django backend
#    7. Python venv deps    — all packages in backend/requirements.txt
#    8. Gunicorn            — production WSGI server
#    9. Cloudflared         — Cloudflare tunnel binary
#   10. ClamAV              — malware scanner
#   11. Docker images       — postgres:16-alpine, minio/minio, adminer,
#                             nginx:1.27-alpine, filebrowser/filebrowser,
#                             mysql:8.0, wordpress:latest
#   12. Docker networks     — hostinger_internal, tenant_isolated
# =============================================================================

set -euo pipefail

# ─── Colour helpers ──────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}[INFO]${RESET}  $*"; }
success() { echo -e "${GREEN}[OK]${RESET}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
error()   { echo -e "${RED}[ERROR]${RESET} $*" >&2; }
header()  { echo -e "\n${BOLD}${CYAN}══ $* ══${RESET}"; }

# ─── Root check ──────────────────────────────────────────────────────────────
if [[ "${EUID}" -ne 0 ]]; then
  error "This script must be run as root."
  echo  "  Run: sudo ./start.sh"
  exit 1
fi

# Keep track of the real (non-root) user so we can set file ownership correctly
REAL_USER="${SUDO_USER:-${USER}}"
REAL_HOME=$(getent passwd "${REAL_USER}" | cut -d: -f6)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export DEBIAN_FRONTEND=noninteractive

# ─── OS detection ────────────────────────────────────────────────────────────
if [[ ! -f /etc/os-release ]]; then
  error "Cannot detect OS. /etc/os-release not found."
  exit 1
fi
source /etc/os-release
info "Detected OS: ${PRETTY_NAME}"

if [[ "${ID}" != "ubuntu" && "${ID}" != "debian" && "${ID_LIKE:-}" != *"debian"* ]]; then
  warn "This script is tested on Ubuntu/Debian. Other distros may need manual adjustments."
fi

# ─── Helper: check if a command exists ───────────────────────────────────────
has() { command -v "$1" &>/dev/null; }

# =============================================================================
# 1. SYSTEM PACKAGES
# =============================================================================
header "1 / 12  System Packages"

apt-get update -qq

SYSTEM_PKGS=(
  # Build tools
  build-essential
  curl
  wget
  git
  unzip
  gnupg
  lsb-release
  ca-certificates
  software-properties-common
  apt-transport-https

  # Python build deps
  python3
  python3-pip
  python3-venv
  python3-dev

  # PostgreSQL client + dev headers (for psycopg2)
  libpq-dev
  postgresql-client

  # MySQL client dev headers (for mysqlclient Python package)
  default-libmysqlclient-dev
  pkg-config

  # Nginx
  nginx

  # ClamAV antivirus
  clamav
  clamav-daemon

  # Misc utilities
  jq
  htop
  net-tools
  ufw

  # Security tooling
  fail2ban
  unattended-upgrades
  apt-listchanges
)

info "Installing system packages…"
apt-get install -y --no-install-recommends "${SYSTEM_PKGS[@]}"
success "System packages installed."

# =============================================================================
# 2. SECURITY TOOLING
# =============================================================================
header "2 / 12  Security tooling"

if has fail2ban-client; then
  if has systemctl; then
    if systemctl enable --now fail2ban >/dev/null 2>&1; then
      success "Fail2Ban service enabled."
    else
      warn "Failed to enable Fail2Ban service; start it manually."
    fi
  else
    warn "systemctl unavailable; skip enabling Fail2Ban."
  fi
else
  warn "Fail2Ban client not found even though package installed."
fi

if has dpkg-reconfigure; then
  info "Configuring unattended-upgrades (non-interactive)…"
  if ! dpkg-reconfigure -f noninteractive unattended-upgrades >/dev/null 2>&1; then
    warn "Unable to reconfigure unattended-upgrades; it may already be configured."
  else
    success "Unattended-upgrades configured for automatic updates."
  fi
else
  warn "dpkg-reconfigure missing; unattended-upgrades configuration skipped."
fi

if has systemctl; then
  if ! systemctl enable --now apt-daily.timer apt-daily-upgrade.timer >/dev/null 2>&1; then
    warn "Could not enable apt daily timers; re-enable manually if needed."
  else
    success "Apt daily timers enabled for unattended upgrades."
  fi
else
  warn "systemctl unavailable; apt timers not enabled."
fi

# =============================================================================
# 2. DOCKER ENGINE  (skip if already installed)
# =============================================================================
header "3 / 12  Docker Engine + Docker Compose Plugin"

if has docker && docker compose version &>/dev/null 2>&1; then
  success "Docker $(docker --version) already installed — skipping."
else
  info "Adding Docker official GPG key and repository…"
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg

  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu \
    $(lsb_release -cs) stable" \
    | tee /etc/apt/sources.list.d/docker.list > /dev/null

  apt-get update -qq
  apt-get install -y \
    docker-ce \
    docker-ce-cli \
    containerd.io \
    docker-buildx-plugin \
    docker-compose-plugin

  # Allow the real user to run Docker without sudo
  usermod -aG docker "${REAL_USER}"
  systemctl enable --now docker
  success "Docker $(docker --version) installed."
fi

# Verify compose v2
if ! docker compose version &>/dev/null; then
  error "Docker Compose plugin not found. Check Docker installation."
  exit 1
fi
success "Docker Compose $(docker compose version --short) ready."

# =============================================================================
# 3. NGINX  (already installed via apt above — just enable & start)
# =============================================================================
header "4 / 12  Nginx"

systemctl enable --now nginx
success "Nginx $(nginx -v 2>&1 | grep -oP '[\d.]+') installed and running."

# =============================================================================
# 4. NODE.JS 20 LTS
# =============================================================================
header "5 / 12  Node.js 20 LTS + npm"

if has node && [[ "$(node --version | cut -d. -f1 | tr -d v)" -ge 18 ]]; then
  success "Node.js $(node --version) already installed — skipping."
else
  info "Installing Node.js 20 LTS via NodeSource…"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
  success "Node.js $(node --version) / npm $(npm --version) installed."
fi

# =============================================================================
# 5. PYTHON VIRTUAL ENVIRONMENT + BACKEND DEPENDENCIES
# =============================================================================
header "6 / 12  Python venv + backend/requirements.txt"

VENV_DIR="${SCRIPT_DIR}/backend/.venv"

if [[ ! -d "${VENV_DIR}" ]]; then
  info "Creating Python virtual environment at ${VENV_DIR}…"
  python3 -m venv "${VENV_DIR}"
fi

PYTHON_BIN="${VENV_DIR}/bin/python"
PIP_BIN="${VENV_DIR}/bin/pip"

info "Upgrading pip…"
"${PIP_BIN}" install --quiet --upgrade pip

info "Installing Python packages from backend/requirements.txt…"
"${PIP_BIN}" install --quiet -r "${SCRIPT_DIR}/backend/requirements.txt"

# =============================================================================
# 6. GUNICORN  (production WSGI server)
# =============================================================================
header "7 / 12  Gunicorn"
"${PIP_BIN}" install --quiet gunicorn
success "Gunicorn $("${PYTHON_BIN}" -m gunicorn --version 2>&1 | awk '{print $NF}') installed."

# Fix ownership of the venv so the real user can use it
chown -R "${REAL_USER}:${REAL_USER}" "${VENV_DIR}"
success "Python venv ready at ${VENV_DIR}"

# =============================================================================
# 7. CLOUDFLARED  (Cloudflare Tunnel)
# =============================================================================
header "8 / 12  Cloudflared"

if has cloudflared; then
  success "Cloudflared $(cloudflared --version | awk '{print $3}') already installed — skipping."
else
  info "Downloading cloudflared from Cloudflare release page…"
  ARCH=$(dpkg --print-architecture)   # amd64 | arm64
  CF_URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${ARCH}.deb"
  TMP_DEB=$(mktemp /tmp/cloudflared-XXXXX.deb)
  curl -fsSL "${CF_URL}" -o "${TMP_DEB}"
  dpkg -i "${TMP_DEB}"
  rm -f "${TMP_DEB}"
  success "Cloudflared $(cloudflared --version | awk '{print $3}') installed."
fi

# =============================================================================
# 8. CLAMAV — update signatures
# =============================================================================
header "9 / 12  ClamAV signatures"

info "Stopping clamav-freshclam to run manual update…"
systemctl stop clamav-freshclam 2>/dev/null || true
freshclam --quiet || warn "freshclam update failed — will retry on next daemon cycle."
systemctl enable --now clamav-freshclam
systemctl enable --now clamav-daemon
success "ClamAV ready."

# =============================================================================
# 9. DOCKER IMAGES  (pre-pull everything the project needs)
# =============================================================================
header "10 / 12  Docker Images"

DOCKER_IMAGES=(
  "postgres:16-alpine"          # Control-plane database
  "minio/minio:latest"          # S3-compatible object storage
  "adminer:latest"              # Database management UI
  "nginx:1.27-alpine"           # API gateway container
  "filebrowser/filebrowser:latest"  # File browser UI
  "mysql:8.0"                   # Tenant databases (WordPress)
  "wordpress:latest"            # WordPress tenant image
)

for image in "${DOCKER_IMAGES[@]}"; do
  info "Pulling ${image}…"
  docker pull "${image}"
  success "  ✓ ${image}"
done

# =============================================================================
# 10. DOCKER NETWORKS
# =============================================================================
header "11 / 12  Docker Networks"

create_network_if_missing() {
  local name="$1"; shift
  if docker network ls --format '{{.Name}}' | grep -q "^${name}$"; then
    warn "Docker network '${name}' already exists — skipping."
  else
    docker network create "$@" "${name}"
    success "Network '${name}' created."
  fi
}

# Internal network for the control-plane services (used in docker-compose.yml)
create_network_if_missing "hostinger_internal" \
  --driver bridge

# Isolated network for tenant containers (WordPress sites, file browser, etc.)
create_network_if_missing "tenant_isolated" \
  --driver bridge \
  --subnet 172.27.0.0/16

# =============================================================================
# 11. NODE MODULES  (frontend dependencies)
# =============================================================================
header "12 / 12  Frontend (npm install)"

info "Installing frontend node_modules…"
cd "${SCRIPT_DIR}"
sudo -u "${REAL_USER}" npm install --prefer-offline --loglevel warn
success "npm packages installed."

FAIL2BAN_VERSION="Not installed"
if has fail2ban-client; then
  FAIL2BAN_VERSION="$(fail2ban-client --version 2>&1 | head -n1)"
fi

APT_TIMER_NOTE="apt daily timers enabled"
if has systemctl; then
  if ! systemctl is-enabled apt-daily.timer >/dev/null 2>&1 || \
     ! systemctl is-enabled apt-daily-upgrade.timer >/dev/null 2>&1; then
    APT_TIMER_NOTE="apt timers need review (enable apt-daily* timers manually)"
  fi
else
  APT_TIMER_NOTE="apt timers not verified (systemctl missing)"
fi

# =============================================================================
# SUMMARY
# =============================================================================
echo ""
echo -e "${BOLD}${GREEN}╔══════════════════════════════════════════════════════╗"
echo -e "║      ✅  All dependencies installed successfully!    ║"
echo -e "╚══════════════════════════════════════════════════════╝${RESET}"
echo ""
echo -e "${BOLD}Installed:${RESET}"
echo -e "  • Docker       $(docker --version | awk '{print $3}' | tr -d ',')"
echo -e "  • Docker Compose $(docker compose version --short)"
echo -e "  • Nginx        $(nginx -v 2>&1 | grep -oP '[\d.]+')"
echo -e "  • Node.js      $(node --version)"
echo -e "  • npm          $(npm --version)"
echo -e "  • Python       $(python3 --version)"
echo -e "  • Gunicorn     $("${PYTHON_BIN}" -m gunicorn --version 2>&1 | awk '{print $NF}')"
echo -e "  • Cloudflared  $(cloudflared --version | awk '{print $3}')"
echo -e "  • Security tools ${FAIL2BAN_VERSION} + ${APT_TIMER_NOTE}"
echo -e "  • ClamAV       $(clamscan --version | head -1)"
echo ""
echo -e "${BOLD}Next steps:${RESET}"
echo -e "  1. Copy backend/.env.example → backend/.env and fill in your secrets"
echo -e "  2. Run: ${CYAN}cd $(pwd) && docker compose up -d${RESET}"
echo -e "  3. Run migrations: ${CYAN}backend/.venv/bin/python backend/manage.py migrate${RESET}"
echo -e "  4. Start the API: ${CYAN}sudo ./backend/scripts/install_platform_services.sh${RESET}"
echo -e "  5. Start frontend: ${CYAN}npm run dev${RESET}"
echo ""
echo -e "${YELLOW}NOTE: Log out and back in (or run 'newgrp docker') so your user"
echo -e "      can run Docker commands without sudo.${RESET}"
