# Configure Nginx for Existing WordPress Sites
# Run this in PowerShell AS ADMINISTRATOR after installing Nginx

Write-Host "=== Configuring Nginx for WordPress Orchestrator ===" -ForegroundColor Cyan
Write-Host ""

# Find Nginx installation
$nginxPaths = @(
    "C:\tools\nginx-1.29.4",
    "C:\nginx",
    "C:\Program Files\nginx",
    "C:\tools\nginx",
    "$env:ProgramData\chocolatey\lib\nginx\tools"
)

# Also check for any nginx folder in C:\tools
$toolsNginx = Get-ChildItem "C:\tools" -Directory -Filter "nginx*" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($toolsNginx) {
    $nginxPaths = @($toolsNginx.FullName) + $nginxPaths
}

$nginxPath = $null
foreach ($path in $nginxPaths) {
    if (Test-Path "$path\nginx.exe") {
        $nginxPath = $path
        break
    }
}

if (-not $nginxPath) {
    Write-Host "ERROR: Nginx not found!" -ForegroundColor Red
    Write-Host "Please install Nginx first using install-nginx.ps1" -ForegroundColor Yellow
    exit 1
}

Write-Host "Found Nginx at: $nginxPath" -ForegroundColor Green
Write-Host ""

# Create sites directory
$sitesDir = "$nginxPath\conf\sites"
if (-not (Test-Path $sitesDir)) {
    New-Item -ItemType Directory -Path $sitesDir -Force | Out-Null
    Write-Host "Created sites directory: $sitesDir" -ForegroundColor Green
}

# Update nginx.conf to include sites
$nginxConf = "$nginxPath\conf\nginx.conf"
$confContent = Get-Content $nginxConf -Raw

if ($confContent -notmatch "include sites/\*\.conf;") {
    Write-Host "Updating nginx.conf to include sites directory..." -ForegroundColor Yellow
    
    # Backup original config
    Copy-Item $nginxConf "$nginxConf.backup" -Force
    
    # Add include directive before the last closing brace in http block
    $confContent = $confContent -replace '(\s+)(#\s*server\s*{[^}]*})?(\s*})(\s*)$', "`$1# WordPress Orchestrator sites`r`n`$1include sites/*.conf;`r`n`$3`$4"
    
    Set-Content -Path $nginxConf -Value $confContent
    Write-Host "nginx.conf updated!" -ForegroundColor Green
}
else {
    Write-Host "nginx.conf already configured" -ForegroundColor Green
}

Write-Host ""
Write-Host "Creating Nginx configs for existing sites..." -ForegroundColor Cyan

# Create config for adi.local
$adiConfig = @"
# WordPress Orchestrator - adi
server {
    listen 80;
    server_name adi.local;
    
    location / {
        proxy_pass http://127.0.0.1:9000;
        proxy_set_header Host `$host;
        proxy_set_header X-Real-IP `$remote_addr;
        proxy_set_header X-Forwarded-For `$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto `$scheme;
        
        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade `$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
"@

Set-Content -Path "$sitesDir\adi.conf" -Value $adiConfig
Write-Host "  Created: adi.conf (adi.local -> localhost:9000)" -ForegroundColor White

# Create config for mysite.local
$mysiteConfig = @"
# WordPress Orchestrator - mysite
server {
    listen 80;
    server_name mysite.local;
    
    location / {
        proxy_pass http://127.0.0.1:9001;
        proxy_set_header Host `$host;
        proxy_set_header X-Real-IP `$remote_addr;
        proxy_set_header X-Forwarded-For `$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto `$scheme;
        
        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade `$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
"@

Set-Content -Path "$sitesDir\mysite.conf" -Value $mysiteConfig
Write-Host "  Created: mysite.conf (mysite.local -> localhost:9001)" -ForegroundColor White

# Create config for ng.local (if exists)
$ngConfig = @"
# WordPress Orchestrator - ng
server {
    listen 80;
    server_name ng.local;
    
    location / {
        proxy_pass http://127.0.0.1:9002;
        proxy_set_header Host `$host;
        proxy_set_header X-Real-IP `$remote_addr;
        proxy_set_header X-Forwarded-For `$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto `$scheme;
        
        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade `$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
"@

Set-Content -Path "$sitesDir\ng.conf" -Value $ngConfig
Write-Host "  Created: ng.conf (ng.local -> localhost:9002)" -ForegroundColor White

Write-Host ""
Write-Host "Testing Nginx configuration..." -ForegroundColor Cyan
& "$nginxPath\nginx.exe" -t

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Starting Nginx..." -ForegroundColor Cyan
    
    # Check if Nginx is already running
    $nginxProcess = Get-Process nginx -ErrorAction SilentlyContinue
    if ($nginxProcess) {
        Write-Host "Nginx is already running. Reloading..." -ForegroundColor Yellow
        & "$nginxPath\nginx.exe" -s reload
    }
    else {
        Start-Process -FilePath "$nginxPath\nginx.exe" -WorkingDirectory $nginxPath -WindowStyle Hidden
        Start-Sleep -Seconds 2
    }
    
    Write-Host ""
    Write-Host "SUCCESS! Nginx is configured and running!" -ForegroundColor Green
    Write-Host ""
    Write-Host "You can now access your sites without port numbers:" -ForegroundColor Cyan
    Write-Host "  http://adi.local" -ForegroundColor White
    Write-Host "  http://mysite.local" -ForegroundColor White
    Write-Host "  http://ng.local" -ForegroundColor White
    Write-Host ""
    Write-Host "Future sites will automatically get Nginx configs!" -ForegroundColor Yellow
}
else {
    Write-Host ""
    Write-Host "ERROR: Nginx configuration test failed!" -ForegroundColor Red
    Write-Host "Please check the error messages above." -ForegroundColor Yellow
}
