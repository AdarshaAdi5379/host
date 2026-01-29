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

**Base URL:** `http://localhost:8000/api/`

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
