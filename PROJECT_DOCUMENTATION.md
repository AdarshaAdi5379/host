# Project Host: WordPress Hosting Platform Documentation

**Last Updated:** February 10, 2026

## 1. Project Overview
"Project Host" is a local-first WordPress hosting platform designed for professional hosting environments on a local Windows machine. It allows users to:
-   Provision isolated WordPress instances in seconds.
-   Access sites via custom local domains (e.g., `mysite.local`) or direct ports (e.g., `localhost:9005`).
-   **Secure User Authentication**: Email/Password and Google OAuth2 login.
-   Monitor real-time CPU and RAM usage for each site.
-   Manage site lifecycle (Start, Stop, Terminate) via a modern React dashboard.
-   Enable public access via Cloudflare Tunnels with one-click subdomain provisioning.
-   Automated disaster recovery with AWS S3 encrypted backups.

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
-   **Authentication**: Token-based (django-rest-knox) + OAuth2 (django-allauth)
-   **Database**: SQLite (Development) / PostgreSQL (Production Control Plane)
-   **Task Queue**: Synchronous (currently driven by API requests)
-   **Cloud Storage**: AWS S3 (for disaster recovery backups)

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
    -   **Update (File Visibility)**: Switched from named Docker volumes to **Bind Mounts** (`./html:/var/www/html`) to ensure files are visible on the host and accessible to the File Manager.
    -   **Update (Config Access)**: Added specific bind mount for `wp-config.php` to ensure it is editable via File Manager while remaining secure.


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
### Phase 9: AWS S3 Disaster Recovery (Automated Backup System)
-   **Action**: Implemented enterprise-grade disaster recovery with AWS S3 integration.
-   **Architecture**: "Dump, Zip, Ship" strategy for tenant database backups.
-   **Implementation**:
    -   **S3 Backup Manager** (`core/s3_backup_manager.py`):
        -   Automated backup compression using gzip (level 6)
        -   Server-side encryption (AES256-SSE-S3)
        -   Configurable retention policies (default: 7 days)
        -   Backup statistics and monitoring
        -   Methods: `verify_credentials()`, `upload_backup()`, `list_backups()`, `delete_old_backups()`
    -   **Management Commands**:
        -   `python manage.py test_s3` - Verify AWS credentials and bucket access
        -   `python manage.py backup_all` - Backup all tenant databases to S3
        -   Options: `--site`, `--dry-run`, `--cleanup-only`, `--skip-cleanup`
    -   **Environment Configuration** (`.env`):
        -   `AWS_ACCESS_KEY_ID` - IAM user access key
        -   `AWS_SECRET_ACCESS_KEY` - IAM user secret key
        -   `AWS_S3_BUCKET_NAME` - Target S3 bucket
        -   `AWS_S3_REGION` - AWS region (e.g., eu-north-1)
        -   `S3_BACKUP_RETENTION_DAYS` - Automatic cleanup threshold
    -   **Backup Process**:
        1. Create mysqldump of tenant database
        2. Compress with gzip (6:1 compression ratio)
        3. Upload to S3 with encryption
        4. Clean up local temporary files
        5. Automatic deletion of backups older than retention period
    -   **S3 Storage Structure**:
        ```
        s3://bucket-name/
        └── backups/
            └── tenants/
                └── {site_name}/
                    └── {site_name}_{timestamp}.sql.gz
        ```
    -   **Security Features**:
        -   Server-side encryption (AES256)
        -   IAM-based access control
        -   Credentials stored in environment variables
        -   Automatic credential verification before operations
-   **Outcome**: 
    -   Automated disaster recovery capability
    -   Encrypted backups stored in AWS S3
    -   One-command backup and restore
    -   AWS Free Tier compatible (5 GB storage)
    -   Automatic retention management
    -   Professional subdomain URLs: `https://sitename.edubricz.online`
    -   Zero-downtime configuration updates

### Phase 10: Custom Domain Management (White-Labeling)
-   **Action**: Enabled users to connect their own domains (e.g., `myshop.com`) to their sites.
-   **Architecture**: Cloudflare API integration for automated DNS Zone management.
-   **Implementation**:
    -   **Cloudflare Zone Manager** (`backend/sites/cloudflare_manager.py`):
        -   Service class interacting with Cloudflare API
        -   Capabilities: Create Zone, Get Status, Delete Zone
        -   Handles API authentication and error mapping
    -   **Database Schema**:
        -   Added `CustomDomain` model (`backend/sites/models.py`)
        -   Fields: `domain_name`, `cloudflare_zone_id`, `nameservers` (JSON), `status`
        -   Relationship: One-to-Many (One WordPressSite can have multiple domains)
    -   **API Endpoints**:
        -   `POST /api/sites/{id}/connect_domain/` - Initiates connection, creates Cloudflare Zone
        -   `GET /api/sites/{id}/domains/` - Lists connected domains
        -   `DELETE /api/sites/{id}/domains/{domain_id}/` - Removes domain and deletes Zone
    -   **Frontend Features**:
        -   **Site-Specific Management**: `/sites/{id}/domains` page for managing a specific site's domains
        -   **Global Overview**: `/domains` page showing all custom domains across all sites
        -   **Connect Domain Modal**: UI for inputting domain name
        -   **Instruction Panel**: Displays assigned nameservers and setup instructions
    -   **User Flow**:
        1. User enters domain (e.g., `example.com`)
        2. System creates Cloudflare Zone via API
        3. System returns generic nameservers (e.g., `ns1.cloudflare.com`)
        4. User updates nameservers at their registrar
        5. Cloudflare validates and activates the zone
-   **Outcome**:
    -   Users can bring their own branding/domains
    -   Automated DNS configuration via Cloudflare
    -   Centralized domain management dashboard
    -   Seamless integration with existing site infrastructure
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

### Authentication Flow (Google OAuth & Email)
1.  **Frontend**: User clicks "Sign in with Google" or submits Login form.
2.  **Redirect (OAuth)**: User is redirected to Google's OAuth consent screen.
3.  **Callback (OAuth)**: Google redirects back to `/auth/google/callback` with an authorization `code`.
4.  **Exchange/Verification**: Backend verifies credentials (password or OAuth code).
5.  **Token Generation**: Backend generates a **Knox Token** (encrypted, persisted in DB).
6.  **Response**: Backend returns token and user profile to Frontend.
7.  **Persistence**: Frontend stores token in `localStorage` securely via Zustand store.
8.  **Session**: Token is attached to `Authorization` header for all subsequent API calls.

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

    docker logs sitename_mysql
    ```

**Problem**: Orphaned containers (Running but not in database)
-   **Cause**: Failed site creation or manual deletion without cleanup
    ./cleanup_orphaned_containers.sh
    ```

**Problem**: Cloudflare Tunnel 530 Error (DNS/Connection Refused)
-   **Cause**: Docker container IP changed after restart, breaking the static configuration in `cloudflared_config.yml`.
-   **Solution**: Assigned **Static IPs** to helper containers in `docker-compose.yml`:
    -   FileBrowser: `172.27.0.10`
    -   Adminer: `172.27.0.11`
    -   Tunnel Config updated to point to these permanent IPs.

**Problem**: File Manager shows only config files, no WordPress content
-   **Cause**: WordPress files were stored in hidden named Docker volumes.
-   **Solution**: Migrated to **Bind Mounts**.
    -   Data is now stored in `backend/wordpress_sites/{site}/html/`.
    -   Users can see and edit all files directly.


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

## 8. Disaster Recovery & Backups

### AWS S3 Backup System

The platform includes enterprise-grade disaster recovery with automated backups to AWS S3.

#### Setup Instructions

1. **Create AWS IAM User**:
   - Go to AWS IAM Console
   - Create new user with programmatic access
   - Attach policy: `AmazonS3FullAccess` (or custom policy with S3 permissions)
   - Save Access Key ID and Secret Access Key

2. **Create S3 Bucket**:
   - Go to AWS S3 Console
   - Create new bucket (e.g., `my-wordpress-backups`)
   - Choose region (e.g., `eu-north-1` for Stockholm)
   - Enable versioning (optional but recommended)

3. **Configure Environment Variables**:
   Edit `backend/.env`:
   ```bash
   AWS_ACCESS_KEY_ID=your_access_key_here
   AWS_SECRET_ACCESS_KEY=your_secret_key_here
   AWS_S3_BUCKET_NAME=your_bucket_name
   AWS_S3_REGION=eu-north-1
   S3_BACKUP_RETENTION_DAYS=7
   ```

4. **Test Connection**:
   ```bash
   cd backend
   python manage.py test_s3
   ```

#### Usage

**Manual Backup (All Sites)**:
```bash
python manage.py backup_all
```

**Backup Specific Site**:
```bash
python manage.py backup_all --site mysite
```

**Dry Run (Preview)**:
```bash
python manage.py backup_all --dry-run
```

**Cleanup Old Backups Only**:
```bash
python manage.py backup_all --cleanup-only
```

#### Automated Backups (Cron)

Add to crontab for daily backups at 2 AM:
```bash
0 2 * * * cd /path/to/backend && python manage.py backup_all
```

#### Backup Features

-   **Compression**: Gzip compression (typically 6:1 ratio)
-   **Encryption**: AES256 server-side encryption
-   **Retention**: Automatic cleanup of old backups
-   **Monitoring**: Real-time statistics and verification
-   **Cost**: AWS Free Tier compatible (5 GB storage)

#### Troubleshooting

**Connection Test Failed**:
- Verify AWS credentials in `.env`
- Check IAM user has S3 permissions
- Confirm bucket exists and region is correct
- Test with: `python manage.py test_s3`

**Backup Failed**:
- Ensure tenant database container is running
- Check Docker permissions
- Verify sufficient disk space
- Review logs for specific error messages

---

## 9. Database Management module

The platform includes a built-in Database Manager that provides a GUI for managing WordPress MySQL databases.

### Architecture

The system uses **Adminer**, a lightweight database management tool, running in a single Docker container that services all tenants.

-   **Service**: Adminer (Official Image)
-   **Network**: `tenant_isolated` (Access to all user databases)
-   **URL**: `https://db.edubricz.online`
-   **Security**:
    -   **Network Isolation**: Adminer cannot be accessed directly via IP (no port binding).
    -   **Tunnel Access**: Only accessible via Cloudflare Tunnel (HTTPS).
    -   **Credential Isolation**: Each tenant DB has a unique, random password.

### Usage

1.  Navigate to **Quick Actions** -> **Databases** (or `/hosting/databases`).
2.  Select a site from the sidebar.
3.  Copy the **Server**, **Username**, and **Password**.
4.  Click **Open Database Manager**.
5.  Paste the credentials into the Adminer login screen (System: MySQL).

### Capabilities
-   View/Edit WordPress tables (`wp_posts`, `wp_users`, etc.).
-   Run custom SQL queries.
-   Export database dumps (.sql).
-   Import data.
-   Diagnose database issues.

---

## 10. Future Enhancements
-   Custom subdomain selection (currently auto-generated from site name)
-   Access control / password protection for public sites
-   Analytics integration via Cloudflare API
-   Multi-domain support
-   ~~Automated backups~~ ✅ **Completed** (AWS S3 integration)
-   Site cloning/templates
-   Automated backup restore functionality
-   WordPress plugin management via API

### Phase 10: Authentication System Overhaul
-   **Action**: Implemented a robust, dual-channel authentication system.
-   **Tech**: `django-allauth`, `dj-rest-auth`, `django-rest-knox`, Google OAuth2.
-   **Implementation**:
    -   **Token Management**:
        -   Replaced JWT with **Knox Token Authentication** for better security and token revocation.
        -   Tokens have a 10-hour TTL (Time To Live) with auto-refresh on activity.
        -   Tokens are persisted in `localStorage` securely via Zustand store.
    -   **Authentication Methods**:
        -   **Email/Password**: Standard secure registration and login.
        -   **Google OAuth2**: One-click login/signup using Google accounts.
    -   **Frontend Integration**:
        -   Centralized `AuthStore` (Zustand) manages user state and token lifecycle.
        -   `ProtectedRoute` component guards sensitive routes (Dashboard, Site Management).
        -   Auto-logout mechanism when tokens expire.
    -   **API Endpoints**:
        -   `/api/auth/register/` - New user registration
        -   `/api/auth/login/` - Password login
        -   `/api/auth/google/` - Google OAuth2 login (Code exchange)
        -   `/api/auth/logout/` - Server-side token invalidation
        -   `/api/auth/user/` - Fetch authenticated user profile
-   **Outcome**:
    -   Seamless login experience with Google or Email.
    -   Secure, persistent sessions with automatic expiration.
    -   Protected dashboard accessible only to authenticated users.

### Phase 11: Database Management Module
-   **Action**: Implemented a secure Database Manager using Adminer.
-   **Tech**: Adminer (Docker), Cloudflare Tunnel, React.
-   **Implementation**:
    -   **Infrastructure**:
        -   Deployed single **Adminer** container on `tenant_isolated` network.
        -   Configured to resolve tenant database hostnames via Docker DNS.
        -   Isolated from external internet, accessible only via Tunnel.
    -   **Access Control**:
        -   **Cloudflare Tunnel**: Routes `https://db.edubricz.online` to Adminer container.
        -   **Security**: No host port binding. Credentials encrypted in DB.
    -   **API**:
        -   `GET /api/sites/{id}/database/` - Returns connection credentials (Host, User, Pass).
        -   Protected by Knox Token and object ownership permissions.
    -   **Frontend**:
        -   **Database Manager** page (`/hosting/databases`): Site selection list.
        -   **DatabaseTab** component: Displays credentials, copy-to-clipboard, "Show Password".
        -   Direct link to Adminer interface.
-   **Outcome**:
    -   One-click access to WordPress MySQL databases.
    -   Secure, authenticated credential retrieval.
    -   No manual port forwarding or command-line required.

### Phase 12: File Manager Module (Web-Based File Access)
-   **Action**: Implemented a visual File Manager using FileBrowser.
-   **Tech**: FileBrowser (Docker), Cloudflare Tunnel, React.
-   **Implementation**:
    -   **Infrastructure**:
        -   Deployed single **FileBrowser** container on `tenant_isolated` network with **Static IP** (`172.27.0.10`) for tunnel stability.
        -   Volume mapped to `../wordpress_sites:/srv` to access all tenant files.
        -   **Storage Strategy**: Migrated all sites to use **Bind Mounts** (`./html`) so files are physically present on the host and visible to FileBrowser.
        -   Configured to use host user permissions (`1000:1000`) for read/write access.
    -   **Access Control**:
        -   **Cloudflare Tunnel**: Routes `https://files.edubricz.online` to FileBrowser container.
        -   **Deep Linking**: Users are directed to their specific site folder (`/files/MySite/`).
        -   **Security**: Upload limit 100MB, Delete disabled by default.
    -   **API**:
        -   `GET /api/sites/{id}/file_manager/` - Returns access URL and disk usage stats.
        -   Calculates real-time directory size for quota monitoring.
    -   **Frontend**:
        -   **File Manager** page (`/hosting/files`): Central hub for file access.
        -   **FileManagerTab** component:
            -   Displays disk usage progress bar.
            -   Provides direct "Open FileBrowser" button.
            -   Shows common task instructions (Upload Theme, Edit Config).
        -   **HostingManagement**: Quick access folder icon on site cards.
-   **Outcome**:
    -   Visual file management without SSH/FTP.
    -   Secure access via HTTPS tunnel.
    -   User-friendly interface for common WordPress tasks.
    -   Real-time disk usage monitoring.


### Phase 13: Server Security Hardening (Phase A)
-   **Action**: Implemented a comprehensive, multi-layer security system to protect the hosting infrastructure.
-   **Tech**: UFW, Fail2Ban, Kernel Sysctl, Docker Network Isolation, Unattended Upgrades.
-   **Implementation**:
    -   **Layer 1: Docker Isolation (The Wall)**
        -   **Action**: Audited and fixed all tenant containers to bind ports to `127.0.0.1` instead of `0.0.0.0`.
        -   **Script**: `backend/security/scripts/fix_docker_ports.py`
        -   **Outcome**: Database and WordPress ports are strictly localhost-only. External access is only possible via Cloudflare Tunnel.
    -   **Layer 2: Firewall - UFW (The Bouncer)**
        -   **Action**: Configured Default Deny Incoming / Allow Outgoing.
        -   **Rule**: Allow `SSH (Port 22)` with rate limiting.
        -   **Script**: `backend/security/scripts/configure_firewall.sh`
        -   **Outcome**: All non-essential ports are blocked at the network level.
    -   **Layer 3: Kernel Hardening (The Camouflage)**
        -   **Action**: Tuned `/etc/sysctl.conf` for network security.
        -   **Settings**: Disabled ICMP Ping (`icmp_echo_ignore_all`), enabled IP Spoofing protection (`rp_filter`), enabled TCP SYN Cookies.
        -   **Script**: `backend/security/scripts/harden_kernel.sh`
        -   **Outcome**: Server ignores pings (Stealth Mode) and is resistant to common network attacks.
    -   **Layer 4: Intrusion Detection (The Guard)**
        -   **Action**: Installed and configured **Fail2Ban**.
        -   **Jail**: Monitors `sshd` logs.
        -   **Policy**: Bans IP for 1 hour after 3 failed login attempts.
        -   **Script**: `backend/security/scripts/install_fail2ban.sh`
        -   **Outcome**: Active protection against brute-force password attacks.
    -   **Layer 5: Automatic Updates (The Maintenance Crew)**
        -   **Action**: Configured `unattended-upgrades`.
        -   **Policy**: Automatically install security patches daily. Auto-reboot at 03:00 if required.
        -   **Script**: `backend/security/scripts/enable_auto_updates.sh`
        -   **Outcome**: Zero-day protection with automated patch management.
-   **Documentation**:
    -   `backend/security/README.md` - Master security guide.
    -   `backend/security/docs/SECURITY_SETUP.md` - Setup and verification steps.
    -   `backend/security/docs/DISASTER_RECOVERY.md` - Emergency procedures.
    -   `backend/security/docs/SSH_KEYS_SETUP.md` - Guide for future SSH key migration.
-   **Future Roadmap (Phase B)**:
    -   Disable Password Authentication for SSH (Requires SSH Key setup).
    -   Implement 2FA for SSH.
    -   Web Application Firewall (ModSecurity).

### Phase 14: Local VPC & Security Groups (Network Isolation)
-   **Objective**: Replicate AWS Security Groups locally to achieve Zero-Trust tenant isolation.
-   **Architecture**: "Lobby and Vault" design using Docker Bridge Networks.
    -   **`vpc_public_web` (The Lobby)**: Standard bridge network. Allows web containers to access the internet (plugins/updates) and receive traffic via Cloudflare Tunnel.
    -   **`vpc_private_db` (The Vault)**: Internal-only bridge network (`internal: true`). No internet access. Prevents data exfiltration.
-   **Implementation Plan**:
    1.  **Network Definition**: Define distinct networks for each tenant in `docker-compose.yml`.
    2.  **Service Assignment**:
        -   **Database**: Assigned ONLY to `vpc_private_db`.
        -   **Web Server**: Assigned to `vpc_public_web` AND `vpc_private_db`.
    3.  **Critical Modification (Backup Access)**:
        -   Databases MUST retain `127.0.0.1` port bindings (e.g., `127.0.0.1:9006:3306`) to allow the Host (Django) to perform backups and Adminer to manage data.
        -   The `internal: true` network flag successfully blocks *internet* access while port binding allows *host* access.
-   **Status**: 🟢 Completed (Verified).
-   **Verification Protocol**:
    -   Automated testing via `backend/scripts/verify_vpc_isolation.py`.
    -   **Results**:
        -   **Database Outbound**: BLOCKED (Zero Trust Confirmed).
        -   **Web Outbound**: ALLOWED (Plugins/Updates Functional).
        -   **Web -> Database**: ALLOWED (Application Functional).

### Phase 15: Local S3 Object Storage (MinIO)
-   **Objective**: Replicate Amazon S3 locally to decouple storage from compute and enable scalable, API-driven file management.
-   **Architecture**: "Cloud Region" model.
    -   **Global Service**: MinIO runs as a shared service on the host (`hostinger_minio`).
    -   **Networking**:
        -   **API**: `http://localhost:9300` (Mapped from 9000).
        -   **Console**: `http://localhost:9301` (Mapped from 9001).
        -   *Note*: Ports were moved from 9000/9001 to avoid conflict with Tenant Sites which utilize the 9000+ range.
    -   **Access**:
        -   **Django**: Connects via Host IP/DNS.
        -   **Tenants**: Connect via Docker Host Gateway.
-   **Configuration**:
    -   **Root Credentials**: Customized in `backend/.env` (User: `hostinger_admin`).
    -   **Bucket**: `hostinger-uploads` (Public Read).
-   **Integration**:
    -   **Django**: Connected via `django-storages` + `boto3`.
    -   **Automated Offload**: Signals (`post_save`) automatically upload WordPress media to MinIO bucket.
    -   **Validation**: Automated script `verify_minio_upload.py` confirms success.
-   **Status**: 🟢 Completed (Verified).

### Phase 16: Multi-Tenant Access Control (Role-Based Visibility)
-   **Objective**: Transition from a single-tenant "Shared Dashboard" to a true **Multi-Tenant System** where users only see their own sites.
-   **Architecture**:
    -   **Regular Users**: Isolated view. Can only see, manage, and delete sites where `owner == user`.
    -   **Super Users (Admins)**: "God Mode" view. Can see and manage **ALL** sites on the platform.
-   **Implementation**:
    -   **Database**:
        -   Added `owner` ForeignKey to `WordPressSite` model (`backend/sites/models.py`).
        -   Migration: `0007_wordpresssite_owner.py`.
    -   **Backend Logic** (`backend/sites/views.py`):
        -   **Query Filtering**: `get_queryset()` checks `request.user.is_superuser`.
        -   **Assignment**: `create()` method automatically assigns `owner=request.user`.
    -   **Frontend Authentication Fix**:
        -   **problem**: Frontend was not sending Auth Headers, causing backend to see `AnonymousUser`.
        -   **Fix**: Updated `wordpressAPI.ts` to inject `Authorization: Token {token}` into every request.
    -   **Management**:
        -   Created comprehensive guide: `brain/super_user_handling.md`.
        -   Tooling for promoting/demoting users via CLI (`manage.py shell`).
-   **Outcome**:
    -   Secure site isolation between users.
    -   Super Admin capability for platform management.
    -   Backfilled ownership for existing sites to the primary admin account.
    -   **Status**: 🟢 Completed (Verified).

### Phase 17: Performance Optimizations (Speed & Efficiency)
-   **Objective**: Reduce the time taken for site lifecycle operations (Creation, Deletion) to improve user experience.
-   **Problem**:
    -   **Creation**: Took ~120s due to fixed sleeps and inefficient loops.
    -   **Deletion**: Took ~70s due to long Docker timeouts.
-   **Implementation**:
    -   **Creation Optimization**:
        -   **Smart Looping**: Reduced database polling interval from 3s to 2s, added early exit.
        -   **Plugin Init**: Reduced fixed delay from 5s to 2s.
        -   **Result**: Creation time reduced by ~50% (avg 50s).
    -   **Deletion Optimization**:
        -   **Timeouts**: Reduced Docker Compose timeout (60s -> 30s) and MySQL stop timeout (10s -> 5s).
        -   **Orphan Cleanup**: Added `--remove-orphans` flag to ensure single-pass cleanup.
        -   **Result**: Deletion time reduced by ~50% (avg 35s).
-   **Outcome**:
    -   Snappier dashboard response.
    -   Less waiting for users.
    -   Cleaner resource teardown.
    -   **Status**: 🟢 Completed (Verified).
