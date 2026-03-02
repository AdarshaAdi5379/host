# Django Backend for WordPress Orchestrator

## Quick Start

### 1. Activate Virtual Environment
```powershell
backend\venv\Scripts\Activate.ps1
```

### 2. Run Development Server
```powershell
python manage.py runserver 8000
```

### 3. API Endpoints

**Base URL (direct Django):** `http://localhost:8000/api/`
**Base URL (API gateway, routing-only phase):** `http://localhost:8088/api/`

#### List all WordPress sites
```
GET /api/sites/
```

#### Create a new WordPress site
```
POST /api/sites/
Content-Type: application/json

{
  "name": "mysite",
  "admin_username": "admin",
  "admin_password": "securepassword123"
}
```

#### Get site details
```
GET /api/sites/{id}/
```

#### Start a site
```
POST /api/sites/{id}/start/
```

#### Stop a site
```
POST /api/sites/{id}/stop/
```

#### Delete a site
```
DELETE /api/sites/{id}/terminate/
```

## API Gateway Worker (required for dynamic `/api/<something>/` routes)

Gateway config applies are queued in the database and executed by a separate worker process.

Apply migrations first:

```bash
python manage.py migrate
```

Run the worker in a separate terminal:

```bash
python manage.py run_gateway_worker
```

Process one ready job and exit:

```bash
python manage.py run_gateway_worker --once
```

### Enable Auto-Start On Boot (systemd)

Install and start the worker service:

```bash
cd /home/adarsha/Desktop/projects/HOST/host/backend
sudo ./scripts/install_gateway_worker_service.sh
```

Install and start the Django API service:

```bash
cd /home/adarsha/Desktop/projects/HOST/host/backend
sudo ./scripts/install_django_api_service.sh
```

Install both Django API + Gateway Worker services together:

```bash
cd /home/adarsha/Desktop/projects/HOST/host/backend
sudo ./scripts/install_platform_services.sh
```

If services restart-loop with `ModuleNotFoundError: No module named 'django'`, reinstall with explicit interpreter:

```bash
sudo PYTHON_BIN="$(python3 -c 'import sys; print(sys.executable)')" ./scripts/install_platform_services.sh
```

Service management:

```bash
sudo systemctl status host-django-api.service --no-pager
sudo systemctl status host-gateway-worker.service --no-pager
sudo systemctl restart host-django-api.service
sudo systemctl restart host-gateway-worker.service
sudo journalctl -u host-django-api.service -f
sudo journalctl -u host-gateway-worker.service -f
```

### Fallback (no systemd)

```bash
cd /home/adarsha/Desktop/projects/HOST/host/backend
./scripts/gateway_worker_ctl.sh start
./scripts/gateway_worker_ctl.sh status
./scripts/gateway_worker_ctl.sh logs
```

### Django API Runtime Mode

The Django service runs through:

- [start_django_api.sh](/home/adarsha/Desktop/projects/HOST/host/backend/scripts/start_django_api.sh)

Behavior:

1. Uses `gunicorn` automatically if installed.
2. Falls back to `manage.py runserver` when `gunicorn` is unavailable.
3. Can force fallback mode with `DJANGO_USE_RUNSERVER=1` in the service environment.

## Project Structure

```
backend/
├── core/                 # Django project settings
│   ├── settings.py      # Configuration (CORS, DRF, etc.)
│   └── urls.py          # Main URL routing
├── sites/               # WordPress orchestrator app
│   ├── models.py        # WordPressSite model
│   ├── serializers.py   # DRF serializers
│   ├── views.py         # API ViewSet
│   ├── orchestrator.py  # Docker/Nginx generation logic
│   └── urls.py          # API routes
├── wordpress_sites/     # Generated WordPress instances
├── manage.py
└── requirements.txt
```

## Technology Stack

- **Django 5.2.10** - Web framework
- **Django REST Framework** - API toolkit
- **django-cors-headers** - CORS middleware
- **PyYAML** - YAML generation for docker-compose
- **Python 3.12** - Runtime environment
