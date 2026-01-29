# Manual Hosts File Fix

Since Django wasn't running as administrator, the hosts file entries weren't added automatically.

## Quick Fix: Add Entries Manually

1. **Open Notepad as Administrator:**
   - Press Windows key
   - Type "Notepad"
   - Right-click → "Run as administrator"

2. **Open hosts file:**
   - File → Open
   - Navigate to: `C:\Windows\System32\drivers\etc`
   - Change file filter to "All Files (*.*)"
   - Open `hosts`

3. **Add these lines at the end:**
```
# WordPress Orchestrator - Managed Entries (DO NOT EDIT MANUALLY)
127.0.0.1 adi.local
127.0.0.1 mysite.local
# End WordPress Orchestrator Entries
```

4. **Save and close**

5. **Test:**
   - Open browser
   - Go to `http://mysite.local` → Should show WordPress on port 9001
   - Go to `http://adi.local` → Should show WordPress on port 9000

## For Future Sites: Run Django as Admin

**Use the PowerShell script:**
1. Close current Django server (Ctrl+C)
2. Right-click `run-django-admin.ps1` in project root
3. Select "Run with PowerShell"
4. When prompted, click "Yes" to allow administrator access

Then new sites will automatically get hosts entries!
