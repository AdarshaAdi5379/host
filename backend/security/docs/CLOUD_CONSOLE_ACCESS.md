# Cloud Provider Console Access Guide

## What Is Cloud Provider Console?

The cloud provider console is a **web-based emergency access** to your server that works even if:
- SSH is broken
- Firewall is blocking you
- Network is misconfigured
- You lost your SSH keys

It's like having a physical monitor and keyboard attached to your server.

---

## How to Access (By Provider)

### AWS EC2

1. **Log into AWS Console**: https://console.aws.amazon.com/
2. Go to **EC2 Dashboard**
3. Find your instance in the list
4. Select it and click **Connect** button
5. Choose **EC2 Instance Connect** or **Session Manager**

**Alternative:**
- Right-click instance → **Connect** → **EC2 Serial Console**

### DigitalOcean

1. **Log into DigitalOcean**: https://cloud.digitalocean.com/
2. Go to **Droplets**
3. Click on your droplet name
4. Click **Console** button (top right)
5. A new window opens with terminal access

**Direct link format:**
```
https://cloud.digitalocean.com/droplets/YOUR_DROPLET_ID/console
```

### Hetzner Cloud

1. **Log into Hetzner Console**: https://console.hetzner.cloud/
2. Select your **Project**
3. Click on your **Server**
4. Click **Console** tab (or the monitor icon)
5. Terminal opens in browser

### Linode

1. **Log into Linode Manager**: https://cloud.linode.com/
2. Go to **Linodes**
3. Click on your Linode
4. Click **Launch LISH Console** (top right)

### Vultr

1. **Log into Vultr**: https://my.vultr.com/
2. Go to **Products** → **Compute**
3. Click on your instance
4. Click **View Console** (monitor icon)

### Google Cloud (GCP)

1. **Log into GCP Console**: https://console.cloud.google.com/
2. Go to **Compute Engine** → **VM Instances**
3. Click **SSH** dropdown next to your instance
4. Select **Open in browser window**

### Azure

1. **Log into Azure Portal**: https://portal.azure.com/
2. Go to **Virtual Machines**
3. Select your VM
4. Click **Connect** → **Serial Console**

---

## What You Can Do in Console

Once you have console access, you can:

✅ **Disable firewall** if locked out:
```bash
sudo ufw disable
```

✅ **Fix SSH configuration**:
```bash
sudo nano /etc/ssh/sshd_config
sudo systemctl restart sshd
```

✅ **Reset passwords**:
```bash
sudo passwd username
```

✅ **Check system logs**:
```bash
sudo tail -f /var/log/syslog
```

---

## Testing Console Access (Do This Now!)

**Before running security scripts**, verify you can access the console:

1. Log into your cloud provider dashboard
2. Navigate to your server/instance
3. Click the Console/Terminal button
4. Verify you can see a login prompt or terminal

**Take a screenshot** of where the console button is located for future reference!

---

## Emergency Recovery Procedure

If you get locked out after running security scripts:

1. **Access cloud provider console** (see above)
2. **Log in** with username/password (if still enabled) or root credentials
3. **Disable firewall**:
   ```bash
   sudo ufw disable
   ```
4. **Restore SSH config**:
   ```bash
   sudo cp /etc/ssh/sshd_config.backup.* /etc/ssh/sshd_config
   sudo systemctl restart sshd
   ```
5. **Re-enable password auth temporarily**:
   ```bash
   sudo sed -i 's/PasswordAuthentication no/PasswordAuthentication yes/' /etc/ssh/sshd_config
   sudo systemctl restart sshd
   ```
6. **SSH in normally** and fix the issue

---

## Provider-Specific Notes

### AWS
- **EC2 Instance Connect** requires specific AMI support
- **Session Manager** requires SSM agent installed
- **Serial Console** must be enabled in account settings

### DigitalOcean
- Console access is always available
- No additional setup required
- Works even if networking is broken

### Hetzner
- Console available for all servers
- May require password reset via rescue mode for root access

---

## Important Reminders

⚠️ **Know your cloud provider** - Make sure you know which one you're using!
✅ **Test console access NOW** - Don't wait until you're locked out
✅ **Bookmark the console URL** - Quick access in emergencies
✅ **Keep provider login credentials safe** - You'll need them for console access

---

## Quick Checklist

Before proceeding with security hardening:

- [ ] I know which cloud provider I'm using
- [ ] I can log into the provider's dashboard
- [ ] I've located the console/terminal access button
- [ ] I've tested console access and can see a terminal
- [ ] I have my provider login credentials saved securely

If you can check all these boxes, you're ready! ✅
