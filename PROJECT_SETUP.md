 # HOST Project Setup (Server)

This guide covers a fresh server setup after cloning the repository.

## 1. Server Prerequisites

Recommended host:

- Ubuntu 22.04/24.04 (or Debian-based)
- sudo access
- Git installed
- Internet access (for apt, npm, pip, Docker pulls)

## 2. Clone the Repository

```bash
cd /opt
sudo git clone <YOUR_GIT_REPO_URL> host
sudo chown -R $USER:$USER /opt/host
cd /opt/host
```

## 3. Install Dependencies (One Command)

Run the project bootstrap script (installs Docker, Node, Python deps, Nginx, etc.):

```bash
chmod +x start.sh
sudo ./start.sh
```

After this step, log out and log back in (or run `newgrp docker`) so Docker works without `sudo`.

## 4. Configure Environment Files

Create backend env file:

```bash
cp backend/.env.example backend/.env
```

Create root env file for Docker Compose + frontend:

```bash
cp backend/.env.example .env
```

Edit both `.env` and `backend/.env` and set real values:

- `DJANGO_SECRET_KEY`
- `DEBUG` (use `False` on server)
- `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`
- `ALLOWED_HOSTS` (root `.env`)
- `VITE_API_BASE_URL` (root `.env`, for frontend)
- `VITE_GOOGLE_CLIENT_ID`, `VITE_GOOGLE_REDIRECT_URI` (if Google login is used)

Important: keep DB values consistent between `.env` and `backend/.env`.

## 5. Start Infrastructure Containers

```bash
docker network create tenant_isolated || true
docker compose up -d
docker compose ps
```

This starts PostgreSQL (`db_system`), MinIO, Adminer, and API gateway.

## 6. Run Django Setup

```bash
backend/.venv/bin/python backend/manage.py migrate
backend/.venv/bin/python backend/manage.py collectstatic --noinput
backend/.venv/bin/python backend/manage.py createsuperuser
```

## 7. Install and Start Backend Services (systemd)

Use the virtualenv interpreter explicitly:

```bash
cd backend
sudo PYTHON_BIN="$(pwd)/.venv/bin/python" ./scripts/install_platform_services.sh
```

Check service status:

```bash
sudo systemctl status host-django-api.service --no-pager
sudo systemctl status host-gateway-worker.service --no-pager
sudo systemctl status host-compute-worker.service --no-pager
```

Tail logs:

```bash
sudo journalctl -u host-django-api.service -f
sudo journalctl -u host-gateway-worker.service -f
sudo journalctl -u host-compute-worker.service -f
```

## 8. Frontend Setup

Install dependencies (if not already done by `start.sh`):

```bash
npm install
```

Development mode:

```bash
npm run dev -- --host 0.0.0.0 --port 5173
```

Production build:

```bash
npm run build
```

## 9. Optional: Compute/KVM Prerequisites

If you will use compute instance features, install and enable libvirt stack:

```bash
sudo apt-get update
sudo apt-get install -y qemu-kvm libvirt-daemon-system libvirt-clients cloud-image-utils ovmf
sudo systemctl enable --now libvirtd
sudo usermod -aG libvirt $USER
```

Then re-login and verify:

```bash
virsh --version
virsh net-list --all
```

## 10. Quick Verification

Check Django API:

```bash
curl -I http://127.0.0.1:8000/api/
```

Check gateway:

```bash
curl -I http://127.0.0.1:8088/api/
```

Check frontend:

```bash
curl -I http://127.0.0.1:5173
```

## 11. Common Issues

`ModuleNotFoundError: No module named 'django'` in systemd:

```bash
cd backend
sudo PYTHON_BIN="$(pwd)/.venv/bin/python" ./scripts/install_platform_services.sh
```

Docker permission denied:

```bash
newgrp docker
```

DB connection errors:

- Recheck `DB_*` values in both `.env` and `backend/.env`
- Confirm DB container is running: `docker compose ps`

## 12. Daily Operations

Start/update stack:

```bash
cd /opt/host
git pull
docker compose up -d
backend/.venv/bin/python backend/manage.py migrate
sudo systemctl restart host-django-api host-gateway-worker host-compute-worker
```
