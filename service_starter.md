# HOST Platform - Service Starter Guide

This guide contains the exact commands required to bring the entire HOST platform and all its dependencies online if the server crashes or restarts.

The platform is divided into four main layers:

1. **Central Infrastructure** (API Gateway, Adminer, Databases, MinIO)
2. **File Management System** (FileBrowser)
3. **Backend Processing** (Django API, Background Workers)
4. **Frontend & Security** (React App, Cloudflare Tunnel)

---

## 1. Central Infrastructure
This starts the local Postgres database, MinIO object storage, Nginx API Gateway, and the Adminer web UI.

**Domain Routing Rules:**
- `api.edubricz.online` → Nginx API Gateway (`localhost:8088`)
- `db.edubricz.online` → Adminer (`localhost:8080`)

**Startup Command:**
```bash
cd /home/adarsha/Desktop/projects/HOST/host/
docker compose --env-file backend/.env up -d
```

## 2. File Management System
This starts the FileBrowser container, which allows users to interact with their website file systems directly from the browser.

**Domain Routing Rules:**
- `files.edubricz.online` → FileBrowser UI (`172.27.0.100:80`)

**Startup Command:**
```bash
cd /home/adarsha/Desktop/projects/HOST/host/backend/filebrowser/
docker compose up -d
```

## 3. Backend Processing (Python Django)
This starts the central backend intelligence holding the platform together. 

*Note: You likely want to use screen, tmux, or systemd for these in production so they don't die when you close the terminal.*

**Startup Commands (Run in separate terminal tabs):**
```bash
cd /home/adarsha/Desktop/projects/HOST/host/backend/

# 1. Start the Django API (Serves requests)
python manage.py runserver 0.0.0.0:8001

# 2. Start the Gateway Worker (Spins up containers/sites)
python manage.py run_gateway_worker

# 3. Start the Compute Worker (Manages virtual machines context)
python manage.py run_compute_worker
```

## 4. Frontend Application (React)
This starts the main HOST dashboard UI.

**Domain Routing Rules:**
- `dashboard.edubricz.online` → React App (`localhost:5173`)

**Startup Command:**
```bash
cd /home/adarsha/Desktop/projects/HOST/host/
npm run dev -- --host 0.0.0.0
```

## 5. Public DNS Routing (Cloudflare Tunnel)
This exposes all your local ports (`:5173`, `:8080`, `:8088`) securely to the public `.edubricz.online` domains. It typically auto-starts when you run the Django API, but you should verify it if domains refuse to load or throw a 502 Bad Gateway.

**Startup Command:**
```bash
cloudflared tunnel --config /home/adarsha/Desktop/projects/HOST/host/backend/cloudflared_config.yml run
```
