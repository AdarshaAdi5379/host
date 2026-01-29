# Fix Nginx - Kill Zombie Processes & Restart
# MUST RUN AS ADMINISTRATOR

$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERROR: You must run this script as Administrator!" -ForegroundColor Red
    Write-Host "Right-click PowerShell -> Run as Administrator" -ForegroundColor Yellow
    exit 1
}

Write-Host "=== Fixing Nginx Process ===" -ForegroundColor Cyan

# 1. Kill invalid processes
Write-Host "Stopping Nginx..." -ForegroundColor Yellow
Stop-Service W3SVC -ErrorAction SilentlyContinue 2>$null
taskkill /F /IM nginx.exe 2>&1 | Out-Null
Start-Sleep -Seconds 2

# Check if port 80 is free
$port80 = Get-NetTCPConnection -LocalPort 80 -ErrorAction SilentlyContinue
if ($port80) {
    Write-Host "WARNING: Port 80 is still in use by PID $($port80.OwningProcess)" -ForegroundColor Red
    taskkill /F /PID $port80.OwningProcess 2>&1 | Out-Null
    Start-Sleep -Seconds 1
}

# 2. Start Nginx cleanly
Write-Host "Starting Nginx..." -ForegroundColor Green
Set-Location "C:\tools\nginx-1.29.4"
Start-Process -FilePath ".\nginx.exe" -WindowStyle Hidden
Start-Sleep -Seconds 3

# 3. Verify
Write-Host "Verifying..." -ForegroundColor Cyan
if (Get-Process nginx -ErrorAction SilentlyContinue) {
    Write-Host "Nginx is RUNNING (PID: $((Get-Process nginx)[0].Id))" -ForegroundColor Green
}
else {
    Write-Host "ERROR: Nginx failed to start!" -ForegroundColor Red
    exit 1
}

Write-Host "Testing Site Access..." -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "http://mysite.local" -UseBasicParsing -TimeoutSec 5
    if ($response.Content -match "WordPress" -or $response.Content -match "wp-") {
        Write-Host "SUCCESS! mysite.local is loading WordPress!" -ForegroundColor Green
    }
    elseif ($response.Content -match "Nginx is working") {
        Write-Host "WARNING: Loading Default Page (Config Loaded, but Site matching failed)" -ForegroundColor Yellow
    }
    else {
        Write-Host "WARNING: Received unexpected content." -ForegroundColor Yellow
    }
}
catch {
    Write-Host "Error accessing site: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "Done! Try opening http://mysite.local in your browser." -ForegroundColor White
