# Quick Hosts File Update Script
# Run this in PowerShell AS ADMINISTRATOR

# Add WordPress Orchestrator entries to hosts file
$hostsPath = "C:\Windows\System32\drivers\etc\hosts"

# Check if entries already exist
$content = Get-Content $hostsPath -Raw
if ($content -notmatch "WordPress Orchestrator") {
    Add-Content -Path $hostsPath -Value "`n# WordPress Orchestrator - Managed Entries (DO NOT EDIT MANUALLY)"
    Add-Content -Path $hostsPath -Value "127.0.0.1 adi.local"
    Add-Content -Path $hostsPath -Value "127.0.0.1 mysite.local"
    Add-Content -Path $hostsPath -Value "# End WordPress Orchestrator Entries"
    Write-Host "Successfully added hosts entries!" -ForegroundColor Green
    Write-Host "You can now access:" -ForegroundColor Cyan
    Write-Host "  - http://adi.local" -ForegroundColor White
    Write-Host "  - http://mysite.local" -ForegroundColor White
}
else {
    Write-Host "Hosts entries already exist!" -ForegroundColor Yellow
}

# Flush DNS cache
ipconfig /flushdns | Out-Null
Write-Host "DNS cache flushed" -ForegroundColor Green
