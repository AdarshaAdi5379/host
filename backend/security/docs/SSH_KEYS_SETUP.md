# SSH Keys Setup Guide

## What Are SSH Keys?

SSH keys are a pair of cryptographic keys used for secure authentication:
- **Private Key**: Stays on your local computer (NEVER share this)
- **Public Key**: Goes on the server (safe to share)

---

## Step 1: Generate SSH Keys (On Your Local Computer)

### Windows (PowerShell or Git Bash):
```bash
ssh-keygen -t ed25519 -C "your_email@example.com"
```

### Linux/Mac (Terminal):
```bash
ssh-keygen -t ed25519 -C "your_email@example.com"
```

**What happens:**
1. It will ask where to save the key - press Enter for default location
2. It will ask for a passphrase - you can press Enter for no passphrase (or add one for extra security)

**Output:**
- Private key: `~/.ssh/id_ed25519` (Windows: `C:\Users\YourName\.ssh\id_ed25519`)
- Public key: `~/.ssh/id_ed25519.pub`

---

## Step 2: Copy Public Key to Server

### Method 1: Using ssh-copy-id (Easiest - Linux/Mac/Git Bash)

```bash
ssh-copy-id username@your_server_ip
```

Replace:
- `username` with your server username (probably `adarsha`)
- `your_server_ip` with your server's IP address

**Example:**
```bash
ssh-copy-id adarsha@203.0.113.50
```

### Method 2: Manual Copy (Windows/All Platforms)

**On your local computer:**
```bash
# Display your public key
cat ~/.ssh/id_ed25519.pub
```

**Copy the entire output** (starts with `ssh-ed25519 AAAA...`)

**On your server:**
```bash
# Create .ssh directory if it doesn't exist
mkdir -p ~/.ssh

# Add your public key
nano ~/.ssh/authorized_keys
# Paste the public key you copied
# Press Ctrl+X, then Y, then Enter to save

# Set correct permissions
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
```

---

## Step 3: Test SSH Key Login

**From your local computer:**
```bash
ssh username@your_server_ip
```

**Expected result:** You should log in WITHOUT being asked for a password.

If it works, you're ready for SSH hardening! ✅

---

## Troubleshooting

### Still asking for password?

**Check permissions on server:**
```bash
ls -la ~/.ssh/
# Should show:
# drwx------ (700) for .ssh directory
# -rw------- (600) for authorized_keys file
```

**Check SSH config allows key auth:**
```bash
sudo grep "PubkeyAuthentication" /etc/ssh/sshd_config
# Should show: PubkeyAuthentication yes
```

---

## Important Notes

⚠️ **NEVER share your private key** (`id_ed25519`)
✅ **Backup your private key** - if you lose it, you lose access
✅ **Test key login BEFORE running SSH hardening script**

---

## Quick Check

Run this on your **local computer** to verify you have keys:

```bash
ls -la ~/.ssh/id_ed25519*
```

If you see `id_ed25519` and `id_ed25519.pub`, you have keys! ✅
