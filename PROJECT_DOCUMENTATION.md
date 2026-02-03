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

### Phase 8: Public Access via Cloudflare Tunnels
-   **Action**: Integrated `cloudflared` for secure public tunneling.
-   **Tech**: Python `subprocess` management of `cloudflared` binary.
-   **Implementation**:
    -   **Backend**: `TunnelManager` module (`tunnel_manager.py`) handles process lifecycle and URL parsing from stderr.
    -   **Database**: Added `tunnel_url`, `tunnel_active`, and `tunnel_process_id` to `WordPressSite` model.
    -   **API**: `start_tunnel` and `stop_tunnel` actions on the ViewSet.
-   **Outcome**: One-click public URLs (e.g., `https://funny-name.trycloudflare.com`) for local sites, enabling external sharing without port forwarding.

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

