# Project Host: WordPress Hosting Platform Documentation

**Last Updated:** January 30, 2026

## 1. Project Overview
"Project Host" is a local-first WordPress hosting platform designed for professional hosting environments on a local Windows machine. It allows users to:
-   Provision isolated WordPress instances in seconds.
-   Access sites via custom local domains (e.g., `mysite.local`) or direct ports (e.g., `localhost:9005`).
-   Monitor real-time CPU and RAM usage for each site.
-   Manage site lifecycle (Start, Stop, Terminate) via a modern React dashboard.

---

## 2. Technology Stack

### Frontend
-   **Framework**: [React 19](https://react.dev/) (via [Vite](https://vitejs.dev/))
-   **Language**: TypeScript
-   **Styling**: TailwindCSS (with `lucide-react` for icons)
-   **State Management**: React Hooks (`useState`, `useEffect`)
-   **HTTP Client**: `fetch` API

### Backend
-   **Framework**: [Django 5.2](https://www.djangoproject.com/) (Python 3.12)
-   **API**: Django REST Framework (DRF)
-   **Database**: SQLite (for app data), MySQL 8.0 (for individual WordPress instances)
-   **Task Queue**: Synchronous (currently driven by API requests)

### Infrastructure & Orchestration
-   **Container Engine**: [Docker Desktop](https://www.docker.com/) (using `docker-py` SDK)
-   **Orchestration**: Docker Compose (generated dynamically per site)
-   **Reverse Proxy**: [Nginx](https://nginx.org/) (Host-level, running natively on Windows)
-   **Local DNS**: Windows `hosts` file modification (Managed via PowerShell scripts)

---

## 3. Architecture Overview

The system follows a **Controller-Agent** pattern where the Django backend acts as the controller for the local Docker daemon.

```mermaid
graph TD
    User[User] -->|Interacts| UI[React Frontend]
    UI -->|API Calls (JSON)| API[Django Backend]
    
    subgraph "Host Machine (Windows)"
        API -->|1. Generate Config| FS[File System]
        API -->|2. Docker SDK| Docker[Docker Daemon]
    end
    
    subgraph "Docker Containers"
        Docker -->|Spins up| WP_Container[WordPress Container]
        Docker -->|Spins up| DB_Container[MySQL Container]
    end
    
    User -->|Direct Access (localhost:PORT)| WP_Container
```

---

## 4. Step-by-Step Implementation Log

### Phase 1: Foundation & Setup
-   **Action**: Initialized a Vite + React project and a Django backend.
-   **Tech**: Configured CORS to allow frontend-backend communication.
-   **Outcome**: A "Hello World" dashboard communicating with a health-check API.

### Phase 2: Authentication
-   **Action**: Implemented JWT (JSON Web Token) authentication.
-   **Tech**: `simplejwt` for Django.
-   **Outcome**: Secure Login/Signup pages. Admin users are flagged for privileged operations.

### Phase 3: The Orchestrator (Core Logic)
-   **Action**: Built `backend/sites/orchestrator.py`.
-   **Logic**:
    1.  **Port Finder**: Scans for available TCP ports to avoid conflicts.
    2.  **Compose Generator**: Creates a unique `docker-compose.yml` for each site.
    3.  **Deployment**: Uses `subprocess` to run `docker-compose up`.
-   **Outcome**: Ability to click "Create Site" and see Docker containers spin up.

### Phase 4: Networking (Simplified)
-   **Original Plan**: Use Nginx + Hosts file for `site.local` domains.
-   **Current State**: **Port-Only Access**.
    -   Removed local Nginx integration to reduce complexity/errors.
    -   Sites are accessed via `http://localhost:PORT`.
    -   Sites are accessed via `http://localhost:PORT`.
    -   **Update (Phase 8)**:  Cloudflare Tunnels added for public access (see below).

### Phase 5: Resource Monitoring (Telemetry)
-   **Action**: Added real-time CPU/RAM stats.
-   **Tech**: `docker-py` to read container stats stream.
-   **Implementation**:
    -   Backend: `/api/sites/{id}/stats/` endpoint calculates CPU % delta and RAM usage.
    -   Frontend: Polling every 3s to update "Pulse" progress bars.
-   **Outcome**: Live visibility into container health.

### Phase 6: Robust Site Creation (The "Smart Config" Fix)
-   **Problem**: WordPress kept redirecting to `localhost` or failing with "Redirect Loops" because it didn't know which port or domain to trust.
-   **Solution (Evolution)**:
    1.  *Attempt 1*: Injecting `WORDPRESS_CONFIG_EXTRA` env var. **Failed** (Unreliable on Windows/Docker).
    2.  *Attempt 2*: Bind mounting `wp-config.php`. **Failed** (File locking/path issues).
    3.  *Final Solution*: **Docker CP Strategy**.
        -   Generate a custom `wp-config.php` on the host.
        -   Spin up the container.
        -   Use `docker cp` to forcefully overwrite the container's config.
        -   Restart container.
    -   **Code**: `views.py` now handles this post-startup injection.
-   **Outcome**: Sites now work immediately on both `localhost:PORT` and custom domains with zero configuration.

### Phase 7: UI & Asset Loading Fix (The "Plain Site" Issue)
-   **Problem**: WordPress Admin Dashboard appeared "plain" (no CSS/JS) and features were missing.
-   **Root Cause**: Dockerized WordPress often fails to concatenate scripts correctly (a known Nginx/Docker issue).
-   **Solution**:
    -   Globally disabled script concatenation in `orchestrator.py` by forcing `define('CONCATENATE_SCRIPTS', false);` in `wp-config.php`.
    -   Ran a batch script to patch existing containers.
-   **Outcome**: Admin dashboard works correctly with full styling.

### Phase 8: Public Access via Cloudflare Tunnels (Persistent Architecture)
-   **Action**: Migrated from Quick Tunnels to a persistent, single-ingress tunnel architecture.
-   **Architecture**: One persistent tunnel manages all sites via dynamic subdomain routing.
-   **Implementation**:
    -   **Tunnel Setup**:
        -   Created persistent tunnel: `f7a24d5d-ea18-477f-bd26-6dfc0f3b2774`
        -   Configured wildcard DNS: `*.edubricz.online` → Tunnel CNAME
        -   Configuration file: `backend/cloudflared_config.yml`
    -   **Backend Modules**:
        -   `IngressManager` (`ingress_manager.py`): Manages dynamic route configuration
        -   Methods: `add_route()`, `remove_route()`, `_reload_tunnel()`
        -   Automatic tunnel restart on configuration changes
    -   **Database Schema**:
        -   Removed: `tunnel_url`, `tunnel_active`, `tunnel_process_id`
        -   Added: `subdomain` (unique), `public_url`, `public_access_enabled`
        -   Migration: `0003_rename_tunnel_active_wordpresssite_public_access_enabled_and_more.py`
    -   **API Endpoints**:
        -   `POST /api/sites/{id}/enable_public_access/` - Enable public access
        -   `POST /api/sites/{id}/disable_public_access/` - Disable public access
        -   Returns: `{"public_url": "https://sitename.edubricz.online", "subdomain": "sitename", "status": "..."}`
    -   **Frontend Integration**:
        -   Updated `wordpressAPI.ts` with new endpoints
        -   Modified `HostingManagement.tsx` to display subdomain URLs
        -   "Go Live" / "Go Local" buttons for one-click public access
    -   **HTTPS Support**:
        -   Updated `wp-config.php` to detect HTTPS from multiple sources
        -   Fixes mixed content errors when accessed via Cloudflare Tunnel
        -   Dynamic protocol detection: `$protocol = 'https'` when appropriate
-   **Outcome**: 
    -   Professional subdomain URLs: `https://sitename.edubricz.online`
    -   Zero-downtime configuration updates
    -   Automatic SSL via Cloudflare
    -   One-click public access from dashboard

---

## 5. How It Works (Under the Hood)

### Site Creation Flow
1.  **Request**: User submits "MyBlog" via UI.
2.  **Allocation**: Backend finds free port (e.g., 9005).
3.  **Generation**:
    -   `docker-compose.yml`: Defines WP + MySQL services.
    -   `wp-config.php`: Created with dynamic URL logic (`WP_HOME` = `HTTP_HOST`).
4.  **Provisioning**:
    -   `docker-compose up` starts the containers.
    -   **Critical**: Backend copies correct `wp-config.php` into the running container via `docker cp`.
    -   Container restarts to apply config.
5.  **Ready**: API returns success, dashboard updates.
    -   User accesses site at `http://localhost:9005`.

---

## 6. How to Run & Develop

### Prerequisites
-   Docker Desktop (Running)
-   Nginx (Running on Windows)
-   Python 3.12+
-   Node.js 20+
-   `cloudflared` binary (installed and in PATH)

### Starting the Project
1.  **Backend (Administrator Terminal)**:
    ```cmd
    cd backend
    .\run-django-admin.bat
    ```
    *(Must run as Admin to update Hosts file/Nginx)*

2.  **Frontend**:
    ```cmd
    npm run dev
    ```

3.  **Access**:
    -   Dashboard: `http://localhost:5173`
    -   API: `http://localhost:8000`

---

## 6. Troubleshooting

### Cloudflare Tunnel Issues

**Problem**: Site returns 404 when accessing public URL
-   **Cause**: Tunnel not reloaded after adding route
-   **Solution**: Tunnel automatically restarts when enabling public access. If issues persist:
    ```bash
    pkill -9 cloudflared
    cloudflared tunnel --config /path/to/cloudflared_config.yml run
    ```

**Problem**: Mixed content errors (HTTP resources on HTTPS page)
-   **Cause**: WordPress not detecting HTTPS correctly
-   **Solution**: Already fixed in `wp-config.php` with dynamic protocol detection. For existing sites, restart WordPress container:
    ```bash
    docker restart sitename_wp
    ```

**Problem**: Multiple cloudflared processes running
-   **Cause**: Previous reload attempts created duplicates
-   **Solution**: Kill all and restart:
    ```bash
    pkill -9 cloudflared
    cloudflared tunnel --config /path/to/cloudflared_config.yml run
    ```

### WordPress Site Issues

**Problem**: Admin dashboard appears "plain" (no CSS/JS)
-   **Cause**: Script concatenation issue in Docker
-   **Solution**: Already fixed in `wp-config.php` with `CONCATENATE_SCRIPTS = false`

**Problem**: Site won't start after creation
-   **Cause**: Port conflict or Docker issue
-   **Solution**: Check logs:
    ```bash
    docker logs sitename_wp
    docker logs sitename_mysql
    ```

---

## 7. Security Considerations

### Sensitive Files (DO NOT COMMIT)
-   `backend/cloudflared_config.yml` - Contains tunnel ID and credentials path
-   `backend/core/settings.py` - Contains Django SECRET_KEY
-   `backend/wordpress_sites/` - Contains database passwords and security salts
-   `backend/.env` - Environment variables (recommended approach)
-   `.cloudflared/*.json` - Tunnel credentials

### Best Practices
1.   **Use Environment Variables**: Store secrets in `.env` file (already in `.gitignore`)
2.   **Rotate Credentials**: If exposed to GitHub, immediately:
     -   Delete and recreate Cloudflare tunnel
     -   Regenerate Django SECRET_KEY
     -   Update DNS records
3.   **Review Before Commit**: Always run `git status` and `git diff` before committing
4.   **Use .gitignore**: Comprehensive `.gitignore` now includes all sensitive patterns

### Current Security Status
⚠️ **WARNING**: Tunnel credentials were previously exposed in git history. See `SECURITY_BREACH_REPORT.md` for remediation steps.

---

## 8. Future Enhancements
-   Custom subdomain selection (currently auto-generated from site name)
-   Access control / password protection for public sites
-   Analytics integration via Cloudflare API
-   Multi-domain support
-   Automated backups
-   Site cloning/templates
-   WordPress plugin management via API
