# HOST Platform - Project Context

## Project Overview
HOST is a modern web hosting platform built with Django (backend) and React (frontend). It provides a full control panel for creating and managing WordPress sites. Each site runs in its own isolated Docker container with a dedicated MySQL database.

The platform includes features for:
- One-click WordPress deployment via Docker.
- Real-time resource monitoring (CPU/RAM).
- Built-in file manager (FileBrowser).
- Public access via Cloudflare Tunnels (dynamically managed).
- Custom domain mapping.
- Automated backups to S3/MinIO.

## Technology Stack

### Backend
- **Framework**: Django 5.2.10 + Django REST Framework 3.15.2
- **Language**: Python
- **Database**:
    - **Development**: SQLite (`db.sqlite3`)
    - **Production**: PostgreSQL (configured but currently disabled in favor of SQLite for dev)
- **Authentication**: `django-rest-knox`, `dj-rest-auth`, `django-allauth`
- **Background Tasks**: None explicit yet (synchronous Docker calls)
- **Infrastructure**:
    - **Docker**: Used to spin up WordPress + MySQL containers dynamically.
    - **Cloudflare**: `cloudflared` tunnel for public access.
    - **Storage**: `django-storages` + `boto3` for S3 backups (MinIO local).

### Frontend
- **Framework**: React 19.2.0 + Vite 7.2.4
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4.1.18 + `lucide-react` icons
- **State Management**: Zustand
- **Routing**: React Router 7.13.0
- **Form Handling**: React Hook Form + Zod
- **Charts**: Recharts (for resource monitoring)

## Architecture

### Backend Structure (`/backend`)
- **`core/`**: Project settings.
    - `settings.py`: Configures DB, CORS, DRF, Knox, Cloudflare paths.
- **`sites/`**: Main application logic.
    - `models.py`: `WordPressSite` (stores container info, port, credentials) and `CustomDomain`.
    - `views.py`: `WordPressSiteViewSet` handles CRUD and Docker orchestration.
    - `docker_utils.py`: Helper functions to run `docker compose` commands.
    - `ingress_manager.py`: Manages `cloudflared_config.yml` for dynamic routing.
    - `filebrowser_manager.py`: Manages users in the `hostinger_files` container.
- **`authentication/`**: Custom user serializers and views.

### Frontend Structure (`/src`)
- **`components/`**: Reusable UI components (shadcn/ui style).
- **`pages/`**:
    - `HostingManagement.tsx`: Main dashboard for sites.
    - `Dashboard.tsx`: Overview with stats.
    - `auth/`: Login/Signup pages.
- **`lib/`**:
    - `api/auth.ts`: Authentication API calls.
    - `wordpressAPI.ts`: Site management API calls.
- **`store/`**: Zustand stores (`authStore.ts`).

## Key Features & How They Work

### 1. WordPress Provisioning
- **Action**: User clicks "New WordPress Site".
- **Backend**:
    1.  Allocates a unique port (starting from 9000).
    2.  Creates a directory `backend/wordpress_sites/{site_name}`.
    3.  Generates a `docker-compose.yml` for the site (WordPress + MySQL).
    4.  Runs `docker compose up -d`.
    5.  Waits for containers to be healthy.
- **Outcome**: A running WordPress site accessible on `localhost:{port}`.

### 2. Public Access (Cloudflare Tunnel)
- **Action**: User clicks "Go Live".
- **Backend (`ingress_manager.py`)**:
    1.  Validates subdomain.
    2.  Adds an ingress rule to `backend/cloudflared_config.yml`:
        ```yaml
        - hostname: mysite.edubricz.online
          service: http://localhost:9000
        ```
    3.  Restarts the `cloudflared` process to apply changes.
- **Frontend**: Displays public URL (`https://mysite.edubricz.online`).

### 3. File Manager
- **Infrastructure**: A single `hostinger_files` container (FileBrowser) mounts the root `wordpress_sites` directory.
- **Access Control**:
    - Each site gets a scoped user (e.g., `fb_test1` scoped to `/test1`).
    - Backend generates credentials and stores them in `WordPressSite` model.
    - User clicks "Open File Manager" -> gets credentials -> logs in.

### 4. Resource Monitoring
- **Backend (`docker_utils.py`)**:
    - `get_container_stats()` fetches real-time CPU/RAM stats via Docker SDK.
- **Frontend (`ResourceMonitor.tsx`)**:
    - Polls `/api/sites/{id}/stats/` every 3 seconds.
    - Displays live usage bars.

## Configuration

### Environment Variables (`backend/.env`)
- `DB_ENGINE`: `sqlite3` (set to `postgresql` only if Postgres is installed).
- `CLOUDFLARE_TUNNEL_TOKEN`: For the main tunnel.
- `AWS_ACCESS_KEY_ID`: For S3 backups.

### Docker
- **Main Compose (`docker-compose.yml`)**: Runs core services (Postgres, MinIO).
- **Site Compose**: Dynamically generated per site.
- **FileBrowser Compose (`backend/filebrowser/docker-compose.yml`)**: Runs the file manager.

## Current State (as of Feb 18, 2026)

### Functional
- **Backend**: Running on port 8000 (SQLite).
- **Frontend**: Running on port 5173 (Vite).
- **Cloudflare Tunnel**: Active (PID 18379), routing `api.edubricz.online`, `dashboard.edubricz.online`, and site subdomains.
- **Site Creation**: Works (creates `test1` etc.).
- **Telemetry**: Works (verified API returns stats).

### Known Issues
- **FileBrowser Credentials**:
    - The `filebrowser.db` file on host is often corrupt/empty, causing `filebrowser` CLI commands to timeout.
    - Existing sites (created before DB reset) have `NULL` credentials.
    - **Fix in Progress**: Debugging DB lock/corruption and provisioning credentials manually.
