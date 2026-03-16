# HOST Project Setup (Server + Services)

This guide is for a fresh server install after cloning the repo, including all major services (Adminer, MinIO, API gateway, FileBrowser, Cloudflared, Django workers).

## 0. One-Command Setup

If you want automated setup, run:

```bash
chmod +x setup.sh
./setup.sh
```

To include superuser creation:

```bash
./setup.sh --with-superuser
```

To auto-collect diagnostics on any setup failure:

```bash
./setup.sh --diagnose
```

Diagnostics output path:

`logs/setup-diagnostics/diagnostics_YYYYMMDD_HHMMSS.log`

## 1. Server Prerequisites

- Ubuntu 22.04/24.04 (or Debian-based)
- `sudo` access
- Internet access
- Open required ports (example): `5173`, `8000`, `8088`, `8080`, `9300`, `9301`

## 2. Clone Repository

```bash
cd /opt
sudo git clone https://github.com/AdarshaAdi5379/host.git host
sudo chown -R $USER:$USER /opt/host
cd /opt/host
```

## 3. Install Base Dependencies

Run the provided installer:

```bash
chmod +x start.sh
sudo ./start.sh
```

What this installs for you:

- Docker + Docker Compose plugin
- Node.js + npm
- Python + venv dependencies in `backend/.venv`
- Nginx
- Cloudflared
- ClamAV
- Fail2ban
- Docker images used by this project

After install, re-login (or run `newgrp docker`) so Docker works without `sudo`.

## 4. Configure Environment Files

Create backend env file:

```bash
cp backend/.env.example backend/.env
```

Create root `.env` (frontend + host-level settings):

```bash
cat > .env <<'EOF'
VITE_API_BASE_URL=http://localhost:8088
VITE_GOOGLE_CLIENT_ID=
VITE_GOOGLE_REDIRECT_URI=http://localhost:5173/auth/google/callback
EOF
```

Set these values in `backend/.env` at minimum.

Core app:

- `DJANGO_SECRET_KEY`
- `DEBUG=False` (for server)
- `ALLOWED_HOSTS` (in `backend/.env`, example: `localhost,127.0.0.1,api.yourdomain.com`)

Database:

- `DB_ENGINE=postgresql`
- `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`

MinIO (required by Django storage settings):

- `MINIO_ROOT_USER`
- `MINIO_ROOT_PASSWORD`
- `MINIO_STORAGE_BUCKET_NAME` (example: `hostinger-uploads`)

Cloudflare tunnel:

- `CLOUDFLARE_DOMAIN`
- `CLOUDFLARE_TUNNEL_ID`
- `CLOUDFLARE_CREDENTIALS_FILE`
- `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` (required for API-managed zone/route features)

Frontend:

- `VITE_API_BASE_URL` in root `.env` (usually `http://<server-ip>:8088` or your API domain)
- `VITE_GOOGLE_CLIENT_ID` and `VITE_GOOGLE_REDIRECT_URI` in root `.env` (if Google login is enabled)

Optional backup-to-S3 keys in `backend/.env`:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_S3_BUCKET_NAME`
- `AWS_S3_REGION`

## 5. Start Core Docker Services

Use `--env-file backend/.env` with Docker Compose commands so DB/MinIO values come from `backend/.env`.

```bash
docker network create tenant_isolated || true
docker compose --env-file backend/.env up -d
docker compose --env-file backend/.env ps
```

This brings up:

- `hostinger_api_gateway` (Nginx API gateway, port `8088`)
- `hostinger_core_db` (PostgreSQL, port `5432`)
- `hostinger_minio` (MinIO API `9300`, console `9301`)
- `hostinger_adminer` (Adminer, port `8080`)

Service notes:

- Adminer UI: `http://<server-ip>:8080`
- MinIO console: `http://<server-ip>:9301` (login with `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD`)
- Adminer login for control-plane DB: System `PostgreSQL`, Server `db_system`, and your `DB_USER` / `DB_PASSWORD`

## 6. Start FileBrowser Service (Recommended)

File manager features depend on this container:

```bash
cd /opt/host/backend/filebrowser
docker compose up -d
docker compose ps
cd /opt/host
```

Container name should be `hostinger_files`.

Important: `backend/filebrowser/docker-compose.yml` pins FileBrowser to `172.27.0.100`. Keep this IP aligned with the `files.*` ingress target in `backend/cloudflared_config.yml`.

## 7. Initialize MinIO Bucket

```bash
cd /opt/host/backend
.venv/bin/python scripts/init_minio_bucket.py
.venv/bin/python scripts/verify_minio_upload.py
cd /opt/host
```

## 8. Django Database + Static Setup

```bash
backend/.venv/bin/python backend/manage.py migrate
backend/.venv/bin/python backend/manage.py collectstatic --noinput
backend/.venv/bin/python backend/manage.py createsuperuser
```

If FileBrowser users need to be created for existing sites:

```bash
backend/.venv/bin/python backend/manage.py setup_filebrowser_users
```

## 9. Install Persistent Backend Services (systemd)

```bash
cd /opt/host/backend
sudo PYTHON_BIN="$(pwd)/.venv/bin/python" ./scripts/install_platform_services.sh
```

This installs/starts:

- `host-django-api.service`
- `host-gateway-worker.service`
- `host-compute-worker.service`

Check:

```bash
sudo systemctl status host-django-api.service --no-pager
sudo systemctl status host-gateway-worker.service --no-pager
sudo systemctl status host-compute-worker.service --no-pager
```

## 10. Cloudflared Setup and Verification

Cloudflared is tied to Django startup in this project. When Django API starts, it auto-starts tunnel using `backend/cloudflared_config.yml`.

1. Ensure Cloudflared is installed:

```bash
cloudflared --version
```

2. Ensure credentials file exists at path set in `CLOUDFLARE_CREDENTIALS_FILE`.

3. Verify tunnel config in:

```bash
cat /opt/host/backend/cloudflared_config.yml
```

Ensure ingress entries point to the right local services (example):

- dashboard -> `http://localhost:5173`
- api -> `http://localhost:8088`
- db -> `http://localhost:8080`
- files -> `http://172.27.0.100:80`

4. Restart Django API service and check logs:

```bash
sudo systemctl restart host-django-api.service
sudo journalctl -u host-django-api.service -f
```

Manual fallback (if needed):

```bash
cloudflared tunnel --config /opt/host/backend/cloudflared_config.yml run
```

If this is a brand-new Cloudflare tunnel setup:

```bash
cloudflared tunnel login
cloudflared tunnel create <your-tunnel-name>
cloudflared tunnel route dns <your-tunnel-name> <your-subdomain.yourdomain.com>
```

## 11. Frontend Setup

```bash
cd /opt/host
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

Production build:

```bash
npm run build
```

## 12. Service Health Checklist

Core host services:

```bash
sudo systemctl status nginx --no-pager
sudo systemctl status fail2ban --no-pager
sudo systemctl status clamav-daemon --no-pager
sudo systemctl status host-django-api --no-pager
sudo systemctl status host-gateway-worker --no-pager
sudo systemctl status host-compute-worker --no-pager
```

Core containers:

```bash
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
```

Quick endpoint checks:

```bash
curl -I http://127.0.0.1:8000/api/
curl -I http://127.0.0.1:8088/api/
curl -I http://127.0.0.1:8080
curl -I http://127.0.0.1:9301
```

Container logs (when debugging):

```bash
docker compose --env-file backend/.env logs --tail=100 api_gateway db_system local_s3 adminer
cd /opt/host/backend/filebrowser && docker compose logs --tail=100 filebrowser
```

## 13. Optional Compute/KVM Prerequisites

If you use compute instance features:

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

## 14. Common Issues

`ModuleNotFoundError: No module named 'django'` in systemd:

```bash
cd /opt/host/backend
sudo PYTHON_BIN="$(pwd)/.venv/bin/python" ./scripts/install_platform_services.sh
```

Docker permission denied:

```bash
newgrp docker
```

Cloudflared not starting:

- Confirm `cloudflared` binary exists in `PATH`
- Confirm `CLOUDFLARE_CREDENTIALS_FILE` points to real JSON credentials
- Confirm `backend/cloudflared_config.yml` has valid `tunnel` + ingress entries

FileBrowser credentials not generated:

- Ensure `hostinger_files` container is running
- Run `backend/.venv/bin/python backend/manage.py setup_filebrowser_users`

No `systemd` available:

```bash
cd /opt/host/backend
./scripts/gateway_worker_ctl.sh start
./scripts/compute_worker_ctl.sh start
./scripts/gateway_worker_ctl.sh status
./scripts/compute_worker_ctl.sh status
```

S3 backup job not running:

```bash
cd /opt/host/backend
./.venv/bin/python manage.py backup_all --dry-run
./.venv/bin/python manage.py backup_all
```

## 15. Daily Operations

```bash
cd /opt/host
git pull
docker compose --env-file backend/.env up -d
cd backend/filebrowser && docker compose up -d && cd /opt/host
backend/.venv/bin/python backend/manage.py migrate
sudo systemctl restart host-django-api host-gateway-worker host-compute-worker
```
