# Fix Nginx Configuration
# Run in PowerShell AS ADMINISTRATOR

Write-Host "Fixing Nginx configuration..." -ForegroundColor Cyan

$nginxConf = "C:\tools\nginx-1.29.4\conf\nginx.conf"

# Backup
Copy-Item $nginxConf "$nginxConf.backup2" -Force

# Read current config
$content = Get-Content $nginxConf -Raw

# Comment out the default server block
$content = $content -replace '(\s+)(server\s*\{[^}]*listen\s+80;[^}]*server_name\s+localhost;[^}]*\})', "`$1# Default server disabled - using WordPress Orchestrator sites`r`n`$1#`$2"

# Make sure include is in the right place (inside http block, before the last })
$content = $content -replace 'include sites/\*\.conf;\s*}', '}'
$content = $content -replace '(http\s*\{(?:[^{}]|\{[^{}]*\})*)(}\s*)$', "`$1    # WordPress Orchestrator sites`r`n    include sites/*.conf;`r`n`$2"

# Write back
Set-Content $nginxConf -Value $content

Write-Host "Testing configuration..." -ForegroundColor Yellow
cd C:\tools\nginx-1.29.4
.\nginx.exe -t

if ($LASTEXITCODE -eq 0) {
    Write-Host "Reloading Nginx..." -ForegroundColor Yellow
    .\nginx.exe -s reload
    Start-Sleep -Seconds 2
    
    Write-Host ""
    Write-Host "SUCCESS! Testing sites..." -ForegroundColor Green
    
    $response = curl http://mysite.local -UseBasicParsing -ErrorAction SilentlyContinue
    if ($response.StatusCode -eq 200 -and $response.Content -notmatch "Welcome to nginx") {
        Write-Host "  mysite.local: WORKING!" -ForegroundColor Green
    }
    else {
        Write-Host "  mysite.local: Still showing default page" -ForegroundColor Yellow
    }
}
else {
    Write-Host "Configuration test failed!" -ForegroundColor Red
}
