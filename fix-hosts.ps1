# Fix Missing Hosts Entries (Smart Version)
# Run as ADMINISTRATOR

$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERROR: Run as Administrator!" -ForegroundColor Red
    exit 1
}

$hostsPath = "$env:SystemRoot\System32\drivers\etc\hosts"
$content = Get-Content $hostsPath -Raw

Write-Host "Detecting running WordPress sites..." -ForegroundColor Cyan

# Get running Docker containers ending in _wp
$sites = docker ps --format "{{.Names}}" | Where-Object { $_ -match "_wp$" } | ForEach-Object { $_ -replace "_wp", "" }

if (-not $sites) {
    Write-Host "No running WordPress sites found!" -ForegroundColor Yellow
    exit
}

$changed = $false

foreach ($site in $sites) {
    $domain = "$site.local"
    
    if ($content -notmatch "127.0.0.1\s+$domain") {
        Write-Host "Adding missing entry: $domain" -ForegroundColor Yellow
        Add-Content -Path $hostsPath -Value "`r`n127.0.0.1 $domain # WordPress Orchestrator"
        $changed = $true
    }
    else {
        Write-Host "Verified: $domain" -ForegroundColor Green
    }
}

if ($changed) {
    Write-Host "Hosts file updated!" -ForegroundColor Green
    ipconfig /flushdns
}
else {
    Write-Host "All hosts entries are correct." -ForegroundColor White
}

Write-Host "`nTesting Nginx Proxy..." -ForegroundColor Cyan
foreach ($site in $sites) {
    $domain = "$site.local"
    try {
        $response = Invoke-WebRequest -Uri "http://$domain" -UseBasicParsing -TimeoutSec 2
        if ($response.StatusCode -eq 200) {
            Write-Host "${domain}: OK" -ForegroundColor Green
        }
        else {
            Write-Host "${domain}: Returned $($response.StatusCode)" -ForegroundColor Yellow
        }
    }
    catch {
        Write-Host "${domain}: Failed - $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "  (Ensure Nginx is running and config exists)" -ForegroundColor Gray
    }
}
