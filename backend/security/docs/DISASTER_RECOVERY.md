# Disaster Recovery Guide

## 🆘 Emergency Scenarios & Solutions

This guide covers what to do when things go wrong.

---

## Scenario 1: Locked Out of SSH

### Symptoms:
- Cannot SSH into server
- "Permission denied (publickey)" error
- Lost SSH private key

### Solution:

#### Option A: Use Cloud Provider Console
1. Log into your cloud provider dashboard (AWS/DigitalOcean/Hetzner)
2. Find "Console" or "VNC" access
3. Log in with username/password (if still enabled) or root credentials
4. Fix SSH configuration:
   ```bash
   # Restore SSH config backup
   sudo cp /etc/ssh/sshd_config.backup.* /etc/ssh/sshd_config
   
   # Temporarily enable password auth
   sudo sed -i 's/PasswordAuthentication no/PasswordAuthentication yes/' /etc/ssh/sshd_config
   
   # Restart SSH
   sudo systemctl restart sshd
   ```
5. SSH in and fix the issue
6. Re-run `harden_ssh.sh` after fixing

#### Option B: Recovery Mode
1. Boot server in recovery/rescue mode (provider-specific)
2. Mount filesystem
3. Edit `/etc/ssh/sshd_config`
4. Reboot normally

---

## Scenario 2: Firewall Blocking Everything

### Symptoms:
- Cannot access server at all
- All connections timeout
- Accidentally blocked SSH

### Solution:

#### Via Console Access:
```bash
# Disable firewall temporarily
sudo ufw disable

# Check rules
sudo ufw status numbered

# Delete problematic rule
sudo ufw delete <rule_number>

# Re-enable with correct rules
sudo ufw enable
```

#### Prevention:
- Always test SSH in another terminal before closing current session
- Use `ufw limit ssh` instead of `ufw allow ssh` for rate limiting

---

## Scenario 3: Cloudflare Tunnel Down

### Symptoms:
- All sites return Error 1033
- Cannot access dashboard/API
- Tunnel process not running

### Solution:

```bash
# Check if tunnel is running
pgrep -af cloudflared

# If not running, restart it
cd /home/adarsha/Desktop/projects/HOST/host/backend
nohup cloudflared tunnel --config cloudflared_config.yml run > cloudflared.log 2>&1 &

# Check logs
tail -f cloudflared.log

# Verify tunnel registered
grep "Registered tunnel connection" cloudflared.log
```

### Make Tunnel Persistent:
Create systemd service:
```bash
sudo nano /etc/systemd/system/cloudflared.service
```

```ini
[Unit]
Description=Cloudflare Tunnel
After=network.target

[Service]
Type=simple
User=adarsha
WorkingDirectory=/home/adarsha/Desktop/projects/HOST/host/backend
ExecStart=/usr/local/bin/cloudflared tunnel --config /home/adarsha/Desktop/projects/HOST/host/backend/cloudflared_config.yml run
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
```

---

## Scenario 4: Docker Containers Won't Start

### Symptoms:
- Containers exit immediately
- Port binding errors
- Network conflicts

### Solution:

```bash
# Check container logs
docker logs <container_name>

# Common issue: Port already in use
sudo netstat -tlnp | grep <port_number>

# Kill process using port
sudo kill <PID>

# Or change port in docker-compose.yml
# From: "127.0.0.1:8000:8000"
# To:   "127.0.0.1:8001:8000"

# Restart containers
docker-compose down
docker-compose up -d
```

---

## Scenario 5: Fail2Ban Banned Your Own IP

### Symptoms:
- Cannot SSH from your location
- Connection refused or timeout
- Works from other IPs

### Solution:

#### Via Console:
```bash
# Check if you're banned
sudo fail2ban-client status sshd

# Unban your IP
sudo fail2ban-client set sshd unbanip YOUR_IP

# Whitelist your IP permanently
sudo nano /etc/fail2ban/jail.local
```

Add under `[DEFAULT]`:
```ini
ignoreip = 127.0.0.1/8 ::1 YOUR_IP
```

```bash
sudo systemctl restart fail2ban
```

---

## Scenario 6: Server Won't Boot After Kernel Update

### Symptoms:
- Server stuck at boot
- Kernel panic
- Cannot access console

### Solution:

1. Boot into recovery mode (provider console)
2. Select previous kernel from GRUB menu
3. Once booted:
   ```bash
   # List installed kernels
   dpkg --list | grep linux-image
   
   # Remove problematic kernel
   sudo apt remove linux-image-X.X.X-XX-generic
   
   # Update GRUB
   sudo update-grub
   ```

---

## Scenario 7: Out of Disk Space

### Symptoms:
- Docker containers failing
- Cannot write files
- Database errors

### Solution:

```bash
# Check disk usage
df -h

# Find large files
sudo du -sh /* | sort -h

# Clean Docker
docker system prune -a --volumes

# Clean old kernels
sudo apt autoremove

# Clean logs
sudo journalctl --vacuum-time=7d
```

---

## Scenario 8: Database Corruption

### Symptoms:
- WordPress sites showing errors
- MySQL won't start
- Data inconsistencies

### Solution:

```bash
# Stop affected container
docker stop <mysql_container>

# Backup current state
docker cp <mysql_container>:/var/lib/mysql ./mysql_backup

# Try repair
docker exec -it <mysql_container> mysqlcheck --all-databases --repair

# If that fails, restore from backup
# (Assuming you have backups - you do, right?)
```

---

## Prevention Checklist

- [ ] Keep backups of SSH keys
- [ ] Document cloud provider console access
- [ ] Test disaster recovery procedures
- [ ] Keep backup of critical configs
- [ ] Monitor disk space
- [ ] Set up automated backups
- [ ] Document custom configurations
- [ ] Keep emergency contact info

---

## Emergency Contacts & Resources

### Cloud Provider Support:
- AWS: https://console.aws.amazon.com/support
- DigitalOcean: https://www.digitalocean.com/support
- Hetzner: https://www.hetzner.com/support

### Useful Commands Reference:

```bash
# System status
systemctl status
journalctl -xe

# Network status
ip addr show
netstat -tlnp

# Disk status
df -h
du -sh /*

# Process status
ps aux | grep <service>
top

# Logs
tail -f /var/log/syslog
tail -f /var/log/auth.log
```

---

## Recovery Checklist

When things go wrong:

1. **Don't Panic** - Most issues are recoverable
2. **Check Logs** - They usually tell you what's wrong
3. **Use Console** - Your backup access method
4. **Restore Backups** - All scripts create backups
5. **Document** - Note what went wrong and how you fixed it
6. **Prevent** - Update procedures to avoid repeat

---

## Backup Locations

All security scripts create backups:

- SSH Config: `/etc/ssh/sshd_config.backup.*`
- Sysctl: `/etc/sysctl.conf.backup.*`
- Fail2Ban: `/etc/fail2ban/jail.local.backup.*`

Keep these safe!
