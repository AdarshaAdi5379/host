# HOST Platform - Complete Project Context

> **Last Updated:** February 18, 2026  
> **Purpose:** This file contains comprehensive project details for AI assistants to understand the entire codebase without reading all individual files.

---

## 1. Project Overview

**HOST** is a modern, full-featured WordPress hosting platform that enables users to create, manage, and deploy isolated WordPress instances locally with public access via Cloudflare Tunnels. It provides a professional-grade control panel similar to Hostinger's hPanel.

### Key Features
- **One-click WordPress deployment** via Docker containers
- **Real-time resource monitoring** (CPU/RAM usage)
- **Public access via Cloudflare Tunnels** with custom subdomains
- **API Gateway & Load Balancing** for centralized API routing and horizontal scaling of React+Django apps
- **Custom domain support** via Cloudflare API integration
- **Built-in file manager** (FileBrowser) for each site
- **Database manager** (Adminer) for MySQL access
- **Automated S3/MinIO backups** for disaster recovery
- **Multi-tenant architecture** with role-based access control
- **Google OAuth2 & Email/Password authentication**

---

## 2. Technology Stack

### Frontend (React + TypeScript)
| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| Framework | React | 19.2.0 | UI library |
| Build Tool | Vite | 7.2.4 | Fast HMR and building |
| Language | TypeScript | 5.9.3 | Type safety |
| Styling | Tailwind CSS | 4.1.18 | Utility-first CSS |
| State Management | Zustand | 5.0.10 | Global state |
| Routing | React Router | 7.13.0 | SPA navigation |
| Forms | React Hook Form + Zod | 7.71.1 / 4.3.6 | Form handling & validation |
| Icons | Lucide React | 0.563.0 | Icon library |
| Charts | Recharts | 3.7.0 | Resource monitoring charts |
| HTTP Client | Native fetch | - | API calls |

### Backend (Django + Python)
| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| Framework | Django | 5.2.10 | Web framework |
| API | Django REST Framework | 3.15.2 | REST API |
| Auth | django-rest-knox + dj-rest-auth + django-allauth | 4.2.0 / 5.0.2 / 0.57.0 | Token auth & OAuth |
| Database | SQLite (dev) / PostgreSQL (prod) | - | Data persistence |
| CORS | django-cors-headers | 4.6.0 | Cross-origin requests |
| Storage | django-storages + boto3 | 1.14.2 / 1.34.0+ | S3/MinIO integration |
| Docker SDK | docker-py | - | Container management |

### Infrastructure
| Component | Technology | Purpose |
|-----------|------------|---------|
| Container Engine | Docker + Docker Compose | WordPress isolation |
| Reverse Proxy | Cloudflare Tunnel | Public access |
| File Manager | FileBrowser | Web-based file access |
| Database Manager | Adminer | MySQL management |
| Object Storage | MinIO | Local S3-compatible storage |
| DNS | Cloudflare API | Custom domain management |

---

## 3. Project Structure

```
host/
├── src/                          # React Frontend
│   ├── components/               # Reusable UI components
│   │   ├── auth/                 # Auth components (ProtectedRoute, etc.)
│   │   ├── billing/              # Billing-related components
│   │   ├── dashboard/            # Dashboard widgets
│   │   ├── domains/              # Domain management components
│   │   ├── email/                # Email management components
│   │   ├── hosting/              # Hosting components (ResourceMonitor, etc.)
│   │   ├── layout/               # Layout components (AppLayout, Sidebar, Navbar)
│   │   ├── loading/              # Loading states
│   │   ├── settings/             # Settings components
│   │   ├── site/                 # Site-specific components (DatabaseTab, FileManagerTab)
│   │   └── ui/                   # Base UI components (Button, Card, Input, etc.)
│   ├── pages/                    # Route-level pages
│   │   ├── auth/                 # Login, Signup, ForgotPassword, etc.
│   │   ├── hosting/              # HostingManagement, CreateHosting, etc.
│   │   ├── domains/              # DomainSearch, DomainTransferWizard
│   │   ├── settings/             # SettingsLayout, GeneralSettings, etc.
│   │   ├── Dashboard.tsx         # Main dashboard
│   │   ├── Analytics.tsx         # Analytics page
│   │   └── ...
│   ├── store/                    # Zustand stores
│   │   └── authStore.ts          # Authentication state
│   ├── lib/                      # Utility functions & API clients
│   │   ├── api/auth.ts           # Auth API calls
│   │   ├── wordpressAPI.ts       # WordPress site API
│   │   └── utils.ts              # General utilities
│   ├── types/                    # TypeScript type definitions
│   │   ├── auth.ts               # User, Role, Permission types
│   │   ├── domain.ts             # Domain, Cart types
│   │   └── deployment.ts         # Deployment types
│   ├── hooks/                    # Custom React hooks
│   ├── data/                     # Static data & mock responses
│   ├── App.tsx                   # Main app component with routes
│   ├── main.tsx                  # Entry point
│   └── index.css                 # Global styles
│
├── backend/                      # Django Backend
│   ├── core/                     # Django project settings
│   │   ├── settings.py           # Main settings (DB, CORS, Auth, Cloudflare)
│   │   ├── urls.py               # URL routing
│   │   ├── s3_backup_manager.py  # AWS S3 backup logic
│   │   └── backup_manager.py     # Local backup logic
│   ├── sites/                    # Main app - WordPress site management
│   │   ├── models.py             # WordPressSite, CustomDomain models
│   │   ├── views.py              # API endpoints (CRUD, actions)
│   │   ├── serializers.py        # DRF serializers
│   │   ├── urls.py               # API URL patterns
│   │   ├── orchestrator.py         # Docker compose & wp-config generation
│   │   ├── docker_utils.py       # Docker execution utilities
│   │   ├── ingress_manager.py    # Cloudflare tunnel route management
│   │   ├── filebrowser_manager.py # FileBrowser user management
│   │   ├── tenant_db_manager.py  # MySQL container management
│   │   ├── cloudflare_manager.py # Cloudflare API integration
│   │   └── signals.py            # Django signals
│   ├── authentication/           # Custom authentication app
│   │   ├── views.py              # Login, register, Google OAuth
│   │   ├── serializers.py        # User serializers
│   │   └── urls.py               # Auth endpoints
│   ├── filebrowser/            # FileBrowser Docker setup
│   ├── adminer/                # Adminer Docker setup
│   ├── security/               # Security hardening scripts
│   ├── scripts/                # Utility scripts
│   ├── wordpress_sites/        # Generated WordPress sites storage
│   ├── backups/                # Backup storage
│   ├── manage.py               # Django management
│   └── requirements.txt        # Python dependencies
│
├── docker-compose.yml          # Main infrastructure (PostgreSQL, MinIO)
├── package.json                # Node dependencies
├── vite.config.ts              # Vite configuration
├── tailwind.config.js          # Tailwind configuration
└── index.html                  # HTML entry point
```

---

## 4. Architecture Details

### 4.1 Two-Tier Database Architecture

**Control Plane (Django & API Gateway):**
- Host-level API Gateway (`hostinger_api_gateway` on Nginx port 8088) routing platform API traffic.
- SQLite for development
- PostgreSQL for production (users, sites metadata, billing)

**Data Plane (Tenant Databases):**
- Each WordPress site gets its own MySQL 8.0 container
- Complete data isolation between tenants
- VPC-style network isolation (`vpc_public_web` + `vpc_private_db`)

### 4.2 VPC Network Architecture ("Lobby and Vault")

```
┌─────────────────────────────────────────────────────────────┐
│                      Host Machine                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              vpc_public_web (Lobby)                 │   │
│  │  ┌─────────────┐         ┌─────────────────────┐     │   │
│  │  │ WordPress   │────────▶│  Internet Access    │     │   │
│  │  │ Container   │         │  (Plugin Updates)   │     │   │
│  │  └──────┬──────┘         └─────────────────────┘     │   │
│  └─────────┼─────────────────────────────────────────────┘   │
│            │                                                │
│            ▼                                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              vpc_private_db (Vault)                   │   │
│  │  ┌─────────────┐         ┌─────────────────────┐     │   │
│  │  │   MySQL     │◀────────│  NO Internet Access │     │   │
│  │  │  Database   │         │  (Zero Trust)       │     │   │
│  │  └─────────────┘         └─────────────────────┘     │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 4.3 Authentication Flow

1. **Email/Password:**
   - User submits credentials → Django verifies → Knox token generated → Stored in localStorage

2. **Google OAuth2:**
   - User clicks "Sign in with Google" → Redirect to Google → Callback with code → Exchange for token → Knox token generated

3. **Token Management:**
   - 10-hour TTL with auto-refresh
   - Sent in `Authorization: Token {token}` header
   - Zustand store persists to localStorage

### 4.4 Load Balancing & Scaling Architecture (React+Django)

- **Frontend proxying:** The tenant's frontend container runs Nginx, providing an `upstream` block pointing to multiple backend replica containers.
- **Dynamic Port Allocation:** Scaling a site provisions unique host ports for each new backend replica (e.g. `9013`, `9014`).
- **Compose rewriting:** The site's `docker-compose.yml` is rewritten on-the-fly to define separate replica services (`backend_1`, `backend_2`), ensuring Docker maintains strict isolation.

### 4.5 Site Creation Flow

1. User submits site name and admin credentials
2. Backend generates:
   - Unique port (9000-9999 range)
   - MySQL credentials (root + app user)
   - `docker-compose.yml` with VPC networks
   - `wp-config.php` with dynamic URL detection
3. FileBrowser user created (scoped to site directory)
4. Docker containers started
5. Background thread handles:
   - WordPress core installation
   - S3/MinIO plugin installation & configuration
   - Initial database backup to S3
6. API returns immediately (~5-10s), background continues

### 4.5 Public Access (Cloudflare Tunnel)

1. User clicks "Go Live" on a running site
2. `IngressManager` validates subdomain
3. Route added to `cloudflared_config.yml`:
   ```yaml
   - hostname: mysite.edubricz.online
     service: http://localhost:9000
   ```
4. Tunnel restarted (all processes killed, new one started)
5. Site accessible at `https://mysite.edubricz.online`

### 4.6 File Manager Architecture

- **Single FileBrowser container** (`hostinger_files`) mounts all sites
- **Scoped users:** Each site gets `fb_{sitename}` user with access only to `/{sitename}`
- **Access:** Via Cloudflare Tunnel at `https://files.edubricz.online`
- **Credentials:** Stored in database, returned via API

### 4.7 Database Manager Architecture

- **Single Adminer container** on `tenant_isolated` network
- **Access:** Via Cloudflare Tunnel at `https://db.edubricz.online`
- **Credentials:** Retrieved per-site via API (`/api/sites/{id}/database/`)
- **Security:** No host port binding, only accessible via tunnel

### 4.8 Backup Architecture (S3/MinIO)

**Local S3 (MinIO):**
- Runs on ports 9300 (API) and 9301 (Console)
- Bucket: `hostinger-uploads`
- WordPress media automatically offloaded via Media Cloud plugin

**AWS S3 Backups:**
- `S3BackupManager` handles upload/download
- Gzip compression (6:1 ratio)
- Server-side encryption (AES256)
- Retention policy (default 7 days)
- Structure: `s3://bucket/backups/tenants/{site_name}/{site_name}_{timestamp}.sql.gz`

---

## 5. Key API Endpoints

### Authentication (`/api/auth/`)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/login/` | POST | Email/password login |
| `/register/` | POST | User registration |
| `/google/` | POST | Google OAuth callback |
| `/logout/` | POST | Token invalidation |
| `/user/` | GET | Get current user profile |

### WordPress Sites (`/api/sites/`)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET/POST | List all sites / Create new site |
| `/{id}/` | GET/PUT/DELETE | Site CRUD operations |
| `/{id}/start/` | POST | Start containers |
| `/{id}/stop/` | POST | Stop containers |
| `/{id}/terminate/` | DELETE | Delete site & cleanup |
| `/{id}/stats/` | GET | Real-time container stats |
| `/{id}/enable_public_access/` | POST | Enable Cloudflare tunnel |
| `/{id}/disable_public_access/` | POST | Disable public access |
| `/{id}/filebrowser_credentials/` | GET | Get FileBrowser credentials |
| `/{id}/database/` | GET | Get database credentials |
| `/{id}/file_manager/` | GET | Get file manager info |
| `/{id}/connect_domain/` | POST | Connect custom domain |
| `/{id}/domains/` | GET | List custom domains |
| `/{id}/domains/{domain_id}/` | DELETE | Remove custom domain |
| `/{id}/snapshot/` | POST | Create DB backup |
| `/aggregate_stats/` | GET | Get all sites resource usage |

---

## 6. Environment Variables

### Backend (`backend/.env`)
```bash
# Django
DJANGO_SECRET_KEY=your-secret-key
DEBUG=True

# Database (Control Plane)
DB_ENGINE=sqlite3  # or postgresql
DB_NAME=hostinger_platform
DB_USER=hostinger_admin
DB_PASSWORD=secure-password
DB_HOST=localhost
DB_PORT=5432

# Cloudflare Tunnel
CLOUDFLARE_DOMAIN=edubricz.online
CLOUDFLARE_TUNNEL_ID=f7a24d5d-ea18-477f-bd26-6dfc0f3b2774
CLOUDFLARE_CREDENTIALS_FILE=/path/to/credentials.json

# AWS S3 / MinIO
AWS_ACCESS_KEY_ID=minio_admin
AWS_SECRET_ACCESS_KEY=minio_password
AWS_S3_BUCKET_NAME=hostinger-uploads
AWS_S3_REGION=us-east-1
S3_BACKUP_RETENTION_DAYS=7

# Google OAuth
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret

# Tenant DB
TENANT_DB_IMAGE=mysql:8.0
TENANT_DB_NETWORK=tenant_isolated
```

---

## 7. Important File Locations

### Configuration Files
| File | Purpose |
|------|---------|
| `backend/core/settings.py` | Django settings (DB, CORS, Auth, Cloudflare) |
| `backend/cloudflared_config.yml` | Cloudflare tunnel routes |
| `vite.config.ts` | Vite build configuration |
| `tailwind.config.js` | Tailwind CSS configuration |

### Key Backend Modules
| File | Purpose |
|------|---------|
| `backend/sites/views.py` | Main API endpoints (800+ lines) |
| `backend/sites/orchestrator.py` | Docker compose generation |
| `backend/sites/ingress_manager.py` | Cloudflare tunnel management |
| `backend/sites/docker_utils.py` | Docker execution utilities |
| `backend/sites/filebrowser_manager.py` | FileBrowser user management |
| `backend/sites/tenant_db_manager.py` | MySQL container management |
| `backend/sites/models.py` | WordPressSite, CustomDomain models |
| `backend/core/s3_backup_manager.py` | AWS S3 backup operations |

### Key Frontend Files
| File | Purpose |
|------|---------|
| `src/App.tsx` | Main routes configuration |
| `src/store/authStore.ts` | Authentication state management |
| `src/lib/wordpressAPI.ts` | WordPress API client |
| `src/lib/api/auth.ts` | Auth API client |
| `src/pages/HostingManagement.tsx` | Main hosting dashboard |
| `src/components/hosting/ResourceMonitor.tsx` | Real-time stats component |

---

## 8. Multi-Tenancy & Security

### User Isolation
- **Regular Users:** Can only see/manage their own sites (`owner == user`)
- **Superusers/Staff:** Can see and manage ALL sites
- **Site Creation:** Automatically assigns `owner = request.user`

### Security Layers
1. **Docker Isolation:** Each site in separate containers
2. **Network Isolation:** VPC-style networks (`vpc_private_db` is internal-only)
3. **Database Isolation:** Each site has its own MySQL container
4. **File Isolation:** FileBrowser users scoped to site directories
5. **Authentication:** Knox tokens with 10-hour TTL
6. **CORS:** Strict origin whitelist

---

## 9. Common Operations

### Creating a New Site
```bash
# Via API
POST /api/sites/
{
  "name": "mysite",
  "admin_username": "admin",
  "admin_password": "securepass"
}
```

### Enabling Public Access
```bash
POST /api/sites/{id}/enable_public_access/
# Returns: {"public_url": "https://mysite.edubricz.online", ...}
```

### Manual Backup
```bash
cd backend
python manage.py backup_all --site mysite
```

### Testing S3 Connection
```bash
cd backend
python manage.py test_s3
```

---

## 10. Known Issues & Solutions

### FileBrowser Database Corruption
- **Issue:** `filebrowser.db` gets locked/corrupt, causing timeouts
- **Solution:** Use `create_user_with_retry()` method with 3 retry attempts

### Cloudflare Tunnel 530 Error
- **Issue:** Docker container IP changes after restart
- **Solution:** Use static IPs for helper containers (FileBrowser: `172.27.0.10`)

### WordPress Admin Dashboard "Plain"
- **Issue:** No CSS/JS loading in wp-admin
- **Solution:** `CONCATENATE_SCRIPTS` set to `false` in `wp-config.php`

### Mixed Content (HTTP on HTTPS)
- **Issue:** Resources loaded over HTTP on HTTPS tunnel
- **Solution:** Dynamic protocol detection in `wp-config.php` based on headers

---

## 11. Development Workflow

### Starting Development
```bash
# Terminal 1: Backend
cd backend
python manage.py runserver  # or run-django-admin.bat on Windows

# Terminal 2: Frontend
npm run dev  # Runs on http://localhost:5173

# Terminal 3: Cloudflare Tunnel
cloudflared tunnel --config backend/cloudflared_config.yml run
```

### Running Migrations
```bash
cd backend
python manage.py migrate
```

### Creating Superuser
```bash
cd backend
python manage.py createsuperuser
```

---

## 12. Testing Accounts

See `TEST_ACCOUNTS.md` for test credentials (if available).

---

## 13. Future Enhancements (Roadmap)

- [ ] Custom subdomain selection (currently auto-generated)
- [ ] Access control / password protection for public sites
- [ ] Analytics integration via Cloudflare API
- [ ] Site cloning/templates
- [ ] Automated backup restore functionality
- [ ] WordPress plugin management via API
- [ ] SSH key authentication (disable password auth)
- [ ] Web Application Firewall (ModSecurity)

---

## 14. File Summary

### Total Files by Type
- **Frontend TypeScript/React:** ~50+ components/pages
- **Backend Python:** ~20+ modules
- **Docker Compose:** 3 files (main, filebrowser, adminer)
- **Configuration:** 5+ files (settings, vite, tailwind, eslint)

### Lines of Code (Approximate)
- **Frontend:** ~5,000+ lines
- **Backend:** ~4,000+ lines
- **Total Project:** ~10,000+ lines

---

*This document is auto-generated for AI context. For the most up-to-date information, always refer to the actual source code.*
