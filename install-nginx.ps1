# Nginx Installation Script for Windows
# Run this in PowerShell AS ADMINISTRATOR

Write-Host "=== WordPress Orchestrator - Nginx Installation ===" -ForegroundColor Cyan
Write-Host ""

# Check if running as administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERROR: This script must be run as Administrator!" -ForegroundColor Red
    Write-Host "Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    exit 1
}

# Check if Nginx is already installed
$nginxInstalled = Get-Command nginx -ErrorAction SilentlyContinue
if ($nginxInstalled) {
    Write-Host "Nginx is already installed at: $($nginxInstalled.Source)" -ForegroundColor Green
    nginx -v
    exit 0
}

Write-Host "Nginx not found. Installing..." -ForegroundColor Yellow
Write-Host ""

# Option 1: Try Chocolatey
$chocoInstalled = Get-Command choco -ErrorAction SilentlyContinue
if ($chocoInstalled) {
    Write-Host "Installing Nginx via Chocolatey..." -ForegroundColor Cyan
    choco install nginx -y
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Nginx installed successfully via Chocolatey!" -ForegroundColor Green
        nginx -v
        exit 0
    }
}

# Option 2: Install Chocolatey first, then Nginx
Write-Host "Chocolatey not found. Would you like to install it? (Recommended)" -ForegroundColor Yellow
Write-Host "This will enable easy package management for Windows." -ForegroundColor Gray
Write-Host ""
Write-Host "Press Y to install Chocolatey + Nginx" -ForegroundColor Cyan
Write-Host "Press N to download Nginx manually" -ForegroundColor Cyan
$choice = Read-Host "Your choice (Y/N)"

if ($choice -eq "Y" -or $choice -eq "y") {
    Write-Host ""
    Write-Host "Installing Chocolatey..." -ForegroundColor Cyan
    
    Set-ExecutionPolicy Bypass -Scope Process -Force
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
    Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
    
    # Refresh environment
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    
    Write-Host "Installing Nginx via Chocolatey..." -ForegroundColor Cyan
    choco install nginx -y
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "SUCCESS! Nginx installed via Chocolatey!" -ForegroundColor Green
        nginx -v
        exit 0
    }
}

# Option 3: Manual download
Write-Host ""
Write-Host "=== Manual Nginx Installation ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Downloading Nginx for Windows..." -ForegroundColor Yellow

$nginxVersion = "1.24.0"
$nginxUrl = "http://nginx.org/download/nginx-$nginxVersion.zip"
$downloadPath = "$env:TEMP\nginx-$nginxVersion.zip"
$installPath = "C:\nginx"

try {
    # Download Nginx
    Write-Host "Downloading from: $nginxUrl" -ForegroundColor Gray
    Invoke-WebRequest -Uri $nginxUrl -OutFile $downloadPath
    
    # Extract to C:\nginx
    Write-Host "Extracting to: $installPath" -ForegroundColor Gray
    Expand-Archive -Path $downloadPath -DestinationPath "C:\" -Force
    
    # Rename folder
    if (Test-Path "C:\nginx-$nginxVersion") {
        if (Test-Path $installPath) {
            Remove-Item $installPath -Recurse -Force
        }
        Rename-Item "C:\nginx-$nginxVersion" "nginx"
    }
    
    # Add to PATH
    $currentPath = [Environment]::GetEnvironmentVariable("Path", "Machine")
    if ($currentPath -notlike "*$installPath*") {
        [Environment]::SetEnvironmentVariable("Path", "$currentPath;$installPath", "Machine")
        $env:Path = "$env:Path;$installPath"
    }
    
    Write-Host ""
    Write-Host "SUCCESS! Nginx installed to: $installPath" -ForegroundColor Green
    Write-Host ""
    Write-Host "Nginx version:" -ForegroundColor Cyan
    & "$installPath\nginx.exe" -v
    
    # Cleanup
    Remove-Item $downloadPath -Force
    
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Close and reopen PowerShell to refresh PATH" -ForegroundColor White
    Write-Host "2. Run: nginx" -ForegroundColor White
    Write-Host "3. Visit: http://localhost" -ForegroundColor White
    
}
catch {
    Write-Host ""
    Write-Host "ERROR: Failed to download/install Nginx" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    Write-Host "Manual installation:" -ForegroundColor Yellow
    Write-Host "1. Download: http://nginx.org/en/download.html" -ForegroundColor White
    Write-Host "2. Extract to: C:\nginx" -ForegroundColor White
    Write-Host "3. Add C:\nginx to system PATH" -ForegroundColor White
    exit 1
}
