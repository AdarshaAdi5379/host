# Run Django as Administrator
# Right-click -> Run with PowerShell

$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERROR: You must run this script as Administrator!" -ForegroundColor Red
    Write-Host "Right-click -> Run with PowerShell (and ensure Admin)" -ForegroundColor Yellow
    
    # Attempt to self-elevate
    Start-Process powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$((Get-Location).Path)\run-django-admin.ps1`"" -Verb RunAs
    exit
}

$scriptPath = $PSScriptRoot
Set-Location "$scriptPath\backend"

if (Test-Path "venv\Scripts\Activate.ps1") {
    Write-Host "Activating venv..." -ForegroundColor Green
    & "venv\Scripts\Activate.ps1"
}
else {
    Write-Host "ERROR: venv not found in backend\venv!" -ForegroundColor Red
    exit 1
}

Write-Host "Starting Django Server..." -ForegroundColor Cyan
python manage.py runserver 8000
