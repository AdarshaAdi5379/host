# Run Django Server as Administrator

## Windows PowerShell (Recommended)

Right-click PowerShell and select "Run as Administrator", then:

```powershell
cd backend
venv\Scripts\Activate.ps1
python manage.py runserver 8000
```

## Alternative: Create Admin Shortcut

1. Create a file `run-django-admin.ps1` with:
```powershell
cd backend
venv\Scripts\Activate.ps1
python manage.py runserver 8000
```

2. Right-click the file → "Run with PowerShell as Administrator"

## Why Administrator Rights?

The WordPress Orchestrator automatically manages the Windows hosts file (`C:\Windows\System32\drivers\etc\hosts`) to enable `.local` domain access. This requires administrator privileges.

**What it does:**
- Adds `127.0.0.1 mysite.local` when you create a site
- Removes entries when you delete a site
- Creates automatic backups before modifications

## Verify Admin Mode

When Django starts, check the console. If you see warnings about hosts file permissions, you're not running as admin.
