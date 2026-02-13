# Server Security Setup Guide

## 🎯 Quick Start (Recommended Order)

Execute these scripts in order for complete server hardening:

```bash
cd /home/adarsha/Desktop/projects/HOST/host/backend/security/scripts

# 1. Audit current Docker security
sudo python3 audit_docker_security.py

# 2. Configure firewall (CRITICAL: Do this before SSH hardening!)
sudo ./configure_firewall.sh

# 3. Harden kernel (Enable stealth mode)
sudo ./harden_kernel.sh

# 4. Install intrusion detection
sudo ./install_fail2ban.sh

# 5. Enable automatic security updates
sudo ./enable_auto_updates.sh

# 6. Harden SSH (DO THIS LAST - requires SSH keys!)
sudo ./harden_ssh.sh
```

---

## 📋 Pre-Requirements

### Before Running ANY Scripts:

1. **Set up SSH Keys** (CRITICAL):
   ```bash
   # On your LOCAL machine (laptop/PC):
   ssh-keygen -t ed25519 -C "admin@edubricz.online"
   ssh-copy-id username@your_server_ip
   
   # Test it works:
   ssh username@your_server_ip
   ```

2. **Have Console Access**:
   - Know how to access your server's web console (AWS/DigitalOcean/Hetzner dashboard)
   - This is your emergency backup if you get locked out

3. **Backup Important Data**:
   - All scripts create backups, but better safe than sorry

---

## 🔒 Script Details

### 1. Docker Security Audit (`audit_docker_security.py`)

**What it does:**
- Scans all `docker-compose.yml` files
- Identifies insecure port bindings (0.0.0.0)
- Checks for privileged containers
- Detects Docker socket exposure

**Usage:**
```bash
sudo python3 audit_docker_security.py
```

**Expected Output:**
- List of security issues to fix
- Recommendations for each issue

---

### 2. Firewall Configuration (`configure_firewall.sh`)

**What it does:**
- Installs UFW (if not present)
- Blocks ALL incoming traffic except SSH
- Enables rate limiting on SSH
- Activates logging

**Usage:**
```bash
sudo ./configure_firewall.sh
```

**Safety Features:**
- Asks for confirmation before enabling
- Keeps SSH port open
- Shows rules before applying

**Rollback:**
```bash
sudo ufw disable
```

---

### 3. Kernel Hardening (`harden_kernel.sh`)

**What it does:**
- Disables ICMP ping (stealth mode)
- Prevents IP spoofing
- Blocks ICMP redirects
- Enables suspicious packet logging
- Activates TCP SYN cookies (DDoS protection)

**Usage:**
```bash
sudo ./harden_kernel.sh
```

**Verification:**
```bash
# From another computer:
ping your_server_ip
# Should timeout (100% packet loss)
```

**Rollback:**
```bash
sudo cp /etc/sysctl.conf.backup.* /etc/sysctl.conf
sudo sysctl -p
```

---

### 4. Fail2Ban Installation (`install_fail2ban.sh`)

**What it does:**
- Installs Fail2Ban
- Configures SSH protection (3 failed attempts = 1 hour ban)
- Enables automatic banning of attackers

**Usage:**
```bash
sudo ./install_fail2ban.sh
```

**Monitoring:**
```bash
# Check banned IPs:
sudo fail2ban-client status sshd

# Unban an IP:
sudo fail2ban-client set sshd unbanip 203.0.113.1

# View logs:
sudo tail -f /var/log/fail2ban.log
```

---

### 5. Automatic Updates (`enable_auto_updates.sh`)

**What it does:**
- Installs unattended-upgrades
- Enables automatic security patches
- Configures auto-reboot at 3 AM if needed
- Removes old kernels automatically

**Usage:**
```bash
sudo ./enable_auto_updates.sh
```

**Monitoring:**
```bash
# View update logs:
sudo cat /var/log/unattended-upgrades/unattended-upgrades.log

# Test configuration:
sudo unattended-upgrades --dry-run
```

---

### 6. SSH Hardening (`harden_ssh.sh`)

**⚠️ WARNING: DO THIS LAST!**

**What it does:**
- Disables password authentication
- Enforces SSH key-only login
- Restricts root login
- Limits connection attempts

**Pre-requirements:**
- SSH keys MUST be set up
- Test key login works BEFORE running

**Usage:**
```bash
sudo ./harden_ssh.sh
```

**Safety Features:**
- Creates backup of SSH config
- Tests configuration before applying
- Asks for confirmation

**Rollback:**
```bash
sudo cp /etc/ssh/sshd_config.backup.* /etc/ssh/sshd_config
sudo systemctl restart sshd
```

---

## ✅ Verification Checklist

After running all scripts, verify from a **different computer**:

| Test | Command | Expected Result |
|------|---------|----------------|
| Ping | `ping your_server_ip` | ❌ Request timeout |
| Port Scan | `nmap -Pn your_server_ip` | Only port 22 visible |
| SSH Password | `ssh -o PubkeyAuthentication=no user@ip` | ❌ Permission denied |
| SSH Key | `ssh user@ip` | ✅ Logs in successfully |
| Direct Web | `curl http://your_server_ip:8000` | ❌ Connection refused |
| Cloudflare Tunnel | `curl https://dashboard.edubricz.online` | ✅ Works normally |

---

## 🆘 Emergency Recovery

### If You Get Locked Out:

1. **Access Web Console:**
   - Log into your cloud provider dashboard
   - Find "Console" or "VNC" access
   - This bypasses network/SSH

2. **Disable Firewall:**
   ```bash
   sudo ufw disable
   ```

3. **Restore SSH Config:**
   ```bash
   sudo cp /etc/ssh/sshd_config.backup.* /etc/ssh/sshd_config
   sudo systemctl restart sshd
   ```

4. **Fix and Re-enable:**
   - Fix the issue
   - Re-run scripts carefully

---

## 📊 Security Status Dashboard

Check your security posture:

```bash
# Firewall status:
sudo ufw status verbose

# SSH configuration:
sudo sshd -T | grep -E "passwordauth|pubkeyauth|permitroot"

# Fail2Ban status:
sudo fail2ban-client status

# Kernel hardening:
sudo sysctl -a | grep -E "icmp_echo_ignore|rp_filter|accept_redirects"

# Auto-updates:
sudo cat /var/log/unattended-upgrades/unattended-upgrades.log | tail -20
```

---

## 🔄 Maintenance

### Weekly:
- Check Fail2Ban logs for attack patterns
- Review unattended-upgrades logs

### Monthly:
- Re-run Docker security audit
- Review firewall logs
- Update SSH keys if needed

### After System Updates:
- Verify firewall still enabled
- Test SSH access
- Check Fail2Ban status

---

## 📞 Support

If you encounter issues:

1. Check script logs (each script shows log locations)
2. Use rollback commands (provided in each section)
3. Access web console if locked out
4. Review `/var/log/auth.log` for SSH issues
