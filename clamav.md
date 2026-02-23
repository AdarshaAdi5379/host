# ClamAV on Docker Environments: Setup & Troubleshooting Guide

This document outlines the theory, commands, and troubleshooting procedures for the ClamAV malware scanning integration implemented on this server.

## Overview & Theory

ClamAV is an open-source antivirus engine designed for detecting trojans, viruses, malware, and other malicious threats.

In a standard Linux setup, running a full `clamscan` across the entire hard drive can be devastating to Server I/O and CPU, often crashing services. For a Docker-based web hosting platform, this is especially dangerous:
1.  **Database Corruption Risk:** Scanning active Docker volumes that hold raw MariaDB/MySQL data fragments (`.ibd`, `ibdata1`) can corrupt the databases or cause severe locking issues for client websites.
2.  **Memory Constraints:** The `clamav-daemon` (which uses `clamdscan`) loads roughly ~1.5GB of virus signatures directly into RAM for instant scanning. While much faster than loading signatures per file (which `clamscan` does), it can trigger OOM (Out Of Memory) killers on smaller servers.
3.  **Permission Conflicts:** If ClamAV detects a file and attempts to move it to a root-owned quarantine folder (`700` permissions), it will fail with "Access Denied" because the daemon runs as the unprivileged `clamav` Linux user.

To mitigate these risks, our implementation features:

*   **Targeted Scanning:** We specifically scan `/var/lib/docker/volumes/` but use regex `--exclude-dir=".*(db|mysql|mariadb|redis).*"` to skip databases.
*   **Daemonized Scanning:** We use `clamdscan` with the `--fdpass` flag to push file descriptions to the background daemon, minimizing CPU spikes.
*   **Secure Quarantine:** The `/var/quarantine` folder is owned by `clamav:clamav` but restricted to `700` to prevent malicious scripts from executing after being quarantined.
*   **Automated Alerting:** A nightly CRON script runs the scan and fires a cURL request to our Django `malware_alert` API endpoint if anything is detected, alerting Super Admins on the dashboard.

---

## Important File Locations

*   **Quarantine Directory:** `/var/quarantine`
*   **Nightly Scan Script:** `/usr/local/bin/nightly_malware_scan.sh`
*   **Scan Log File:** `/var/log/clamav/nightly_scan.log`
*   **ClamAV Daemon Config:** `/etc/clamav/clamd.conf`
*   **Freshclam (Updater) Config:** `/etc/clamav/freshclam.conf`

---

## Common Administrative Commands

### 1. Service Management
ClamAV is split into two services: the scanner daemon (`clamav-daemon`) and the signature updater (`clamav-freshclam`).

```bash
# Check status of the scanner
sudo systemctl status clamav-daemon

# Check status of the updater
sudo systemctl status clamav-freshclam

# Restart the scanner (Can take 1-3 minutes to load signatures into RAM)
sudo systemctl restart clamav-daemon
```

### 2. Updating Signatures Manually
The `freshclam` service usually runs in the background automatically a few times a day. If you need to force an update:

```bash
sudo systemctl stop clamav-freshclam
sudo freshclam
sudo systemctl start clamav-freshclam
```

### 3. Running Scans Manually
You can trigger the nightly script manually at any time to test the flow:

```bash
sudo /usr/local/bin/nightly_malware_scan.sh
```

Or run a targeted clamdscan manually:
```bash
# Scan a specific directory and move infections to quarantine
sudo clamdscan /path/to/suspect/folder --move=/var/quarantine --multiscan --fdpass
```

### 4. Viewing Logs
To see the history of nightly scans and what was found:
```bash
cat /var/log/clamav/nightly_scan.log
```

---

## Troubleshooting Guide

### Issue 1: `clamdscan` returns "Access Denied" or fails to move files to Quarantine
**Cause:** The `/var/quarantine` folder is likely owned by `root:root`. The `clamav-daemon` runs under the `clamav` user and cannot write to it.
**Fix:**
```bash
sudo chown clamav:clamav /var/quarantine
sudo chmod 700 /var/quarantine
```

### Issue 2: Site/Database Crashes During Scan
**Cause:** The `--exclude-dir` flag in the script failed to catch your specific database volume naming convention.
**Fix:** 
1. Open `/usr/local/bin/nightly_malware_scan.sh`.
2. Find the line: `OUTPUT=$(clamdscan "$SCAN_DIR" --exclude-dir=".*(db|mysql|mariadb|redis).*" ...)`
3. Update the regex group `(db|mysql|mariadb|redis)` to include whatever distinct string your new database volumes use.

### Issue 3: `clamav-daemon` fails to start / Out of Memory (OOM)
**Cause:** ClamAV requires at least 2GB of available RAM to load its signature database. If the server doesn't have enough, Linux will kill the process immediately.
**Fix:**
Check your system RAM (`free -m`). If you are consistently maxing out RAM, you must either:
*   **Option A (Recommended):** Upgrade the server RAM or create a larger Swapfile.
*   **Option B (Slower):** Uninstall `clamav-daemon` and rewrite `nightly_malware_scan.sh` to use the basic `clamscan` command instead of `clamdscan`. `clamscan` consumes high CPU and takes 10x longer, but frees memory immediately after finishing.

### Issue 4: Malware is quarantined, but Django Dashboard doesn't show the alert.
**Cause:** The `curl` command inside the bash script failed to reach the local Django API.
**Debug Steps:**
1. Check the bash script logs: `tail -n 20 /var/log/clamav/nightly_scan.log`.
2. Manually test the API ping from the server terminal:
   ```bash
   curl -X POST http://localhost:8000/api/admin/malware_alert/ \
        -H "Content-Type: application/json" \
        -d '{"message": "Manual Test", "infected_count": "1"}'
   ```
3. If it fails, ensure the Django server is running and accessible on port `8000` via `localhost` (127.0.0.1). Ensure the endpoint in `backend/sites/views.py` allows requests from `127.0.0.1`.

