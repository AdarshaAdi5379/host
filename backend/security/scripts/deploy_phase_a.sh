#!/bin/bash
###############################################################################
# Master Security Deployment Script - Phase A (Safe Layers)
# Purpose: Deploy all safe security layers in one go
# These layers do NOT require SSH keys and won't lock you out
###############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     Security Hardening - Phase A Deployment           ║${NC}"
echo -e "${GREEN}║     (Safe Layers - No SSH Keys Required)              ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}\n"

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}ERROR: This script must be run as root (use sudo)${NC}"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Summary of what will be done
echo -e "${YELLOW}This script will:${NC}"
echo -e "  1. ✅ Harden kernel (stealth mode - no ping response)"
echo -e "  2. ✅ Install and configure Fail2Ban (intrusion detection)"
echo -e "  3. ✅ Enable automatic security updates"
echo -e "  4. ✅ Configure UFW firewall (blocks all except SSH)"
echo -e ""
echo -e "${YELLOW}What will NOT be done:${NC}"
echo -e "  ⏭  SSH hardening (requires SSH keys - Phase B)"
echo -e ""
echo -e "${GREEN}These changes are SAFE and won't lock you out.${NC}"
echo -e ""

read -p "Continue? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo -e "${YELLOW}Aborted.${NC}"
    exit 0
fi

echo -e "\n${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Step 1/4: Kernel Hardening${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}\n"

# Kernel Hardening
SYSCTL_CONF="/etc/sysctl.conf"
BACKUP_FILE="/etc/sysctl.conf.backup.$(date +%Y%m%d_%H%M%S)"

cp "$SYSCTL_CONF" "$BACKUP_FILE"
echo -e "${GREEN}✓ Backup created: $BACKUP_FILE${NC}"

cat >> "$SYSCTL_CONF" << 'EOF'

###############################################################################
# Security Hardening Settings
###############################################################################
net.ipv4.icmp_echo_ignore_all = 1
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv6.conf.all.accept_redirects = 0
net.ipv6.conf.default.accept_redirects = 0
net.ipv4.conf.all.accept_source_route = 0
net.ipv4.conf.default.accept_source_route = 0
net.ipv6.conf.all.accept_source_route = 0
net.ipv6.conf.default.accept_source_route = 0
net.ipv4.conf.all.log_martians = 1
net.ipv4.conf.default.log_martians = 1
net.ipv4.icmp_echo_ignore_broadcasts = 1
net.ipv4.icmp_ignore_bogus_error_responses = 1
net.ipv4.tcp_syncookies = 1
EOF

sysctl -p > /dev/null 2>&1
echo -e "${GREEN}✓ Kernel hardening applied${NC}"
echo -e "${GREEN}✓ Server will no longer respond to ping${NC}\n"

echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Step 2/4: Fail2Ban Installation${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}\n"

# Install Fail2Ban
if ! command -v fail2ban-client &> /dev/null; then
    echo -e "${YELLOW}Installing Fail2Ban...${NC}"
    apt-get update > /dev/null 2>&1
    apt-get install -y fail2ban > /dev/null 2>&1
    echo -e "${GREEN}✓ Fail2Ban installed${NC}"
else
    echo -e "${GREEN}✓ Fail2Ban already installed${NC}"
fi

# Configure Fail2Ban
JAIL_LOCAL="/etc/fail2ban/jail.local"

cat > "$JAIL_LOCAL" << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 3

[sshd]
enabled = true
port = ssh
logpath = %(sshd_log)s
backend = %(sshd_backend)s
maxretry = 3
bantime = 3600
findtime = 600
EOF

systemctl enable fail2ban > /dev/null 2>&1
systemctl restart fail2ban > /dev/null 2>&1
echo -e "${GREEN}✓ Fail2Ban configured and started${NC}"
echo -e "${GREEN}✓ SSH brute force protection active${NC}\n"

echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Step 3/4: Automatic Security Updates${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}\n"

# Install unattended-upgrades
if ! dpkg -l | grep -q unattended-upgrades; then
    echo -e "${YELLOW}Installing unattended-upgrades...${NC}"
    apt-get update > /dev/null 2>&1
    apt-get install -y unattended-upgrades apt-listchanges > /dev/null 2>&1
    echo -e "${GREEN}✓ unattended-upgrades installed${NC}"
else
    echo -e "${GREEN}✓ unattended-upgrades already installed${NC}"
fi

# Configure automatic updates
cat > /etc/apt/apt.conf.d/20auto-upgrades << 'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Download-Upgradeable-Packages "1";
APT::Periodic::AutocleanInterval "7";
APT::Periodic::Unattended-Upgrade "1";
EOF

cat > /etc/apt/apt.conf.d/50unattended-upgrades << 'EOF'
Unattended-Upgrade::Allowed-Origins {
    "${distro_id}:${distro_codename}-security";
    "${distro_id}ESMApps:${distro_codename}-apps-security";
    "${distro_id}ESM:${distro_codename}-infra-security";
};
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "03:00";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
Unattended-Upgrade::Remove-New-Unused-Dependencies "true";
EOF

echo -e "${GREEN}✓ Automatic security updates enabled${NC}"
echo -e "${GREEN}✓ System will auto-reboot at 3 AM if needed${NC}\n"

echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Step 4/4: UFW Firewall Configuration${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}\n"

# Install UFW
if ! command -v ufw &> /dev/null; then
    echo -e "${YELLOW}Installing UFW...${NC}"
    apt-get update > /dev/null 2>&1
    apt-get install -y ufw > /dev/null 2>&1
    echo -e "${GREEN}✓ UFW installed${NC}"
else
    echo -e "${GREEN}✓ UFW already installed${NC}"
fi

# Configure UFW
ufw --force reset > /dev/null 2>&1
ufw default deny incoming > /dev/null 2>&1
ufw default allow outgoing > /dev/null 2>&1
ufw limit ssh comment 'SSH with rate limiting' > /dev/null 2>&1
ufw logging on > /dev/null 2>&1
echo "y" | ufw enable > /dev/null 2>&1

echo -e "${GREEN}✓ Firewall configured and enabled${NC}"
echo -e "${GREEN}✓ All ports blocked except SSH (with rate limiting)${NC}\n"

echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           Phase A Deployment Complete! ✅              ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}\n"

echo -e "${YELLOW}Summary of Changes:${NC}"
echo -e "  ✅ Kernel hardened (stealth mode active)"
echo -e "  ✅ Fail2Ban protecting SSH (3 attempts = 1 hour ban)"
echo -e "  ✅ Automatic security updates enabled"
echo -e "  ✅ Firewall active (only SSH port open)"

echo -e "\n${YELLOW}Verification:${NC}"
echo -e "  • Firewall status: ${GREEN}sudo ufw status verbose${NC}"
echo -e "  • Fail2Ban status: ${GREEN}sudo fail2ban-client status sshd${NC}"
echo -e "  • Test ping (from another machine): Should timeout ✅"

echo -e "\n${BLUE}Next Steps (Phase B - Requires SSH Keys):${NC}"
echo -e "  1. Set up SSH keys (see: security/docs/SSH_KEYS_SETUP.md)"
echo -e "  2. Test SSH key login"
echo -e "  3. Run: ${GREEN}sudo ./harden_ssh.sh${NC}"

echo -e "\n${YELLOW}Rollback (if needed):${NC}"
echo -e "  • Kernel: ${GREEN}sudo cp $BACKUP_FILE /etc/sysctl.conf && sudo sysctl -p${NC}"
echo -e "  • Firewall: ${GREEN}sudo ufw disable${NC}"
echo -e "  • Fail2Ban: ${GREEN}sudo systemctl stop fail2ban${NC}"

echo -e "\n${GREEN}All systems secured! 🛡️${NC}"
