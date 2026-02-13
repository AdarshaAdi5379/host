#!/bin/bash
###############################################################################
# Automatic Security Updates Configuration
# Purpose: Enable unattended-upgrades for automatic security patches
###############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=== Automatic Security Updates Setup ===${NC}\n"

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}ERROR: This script must be run as root (use sudo)${NC}"
    exit 1
fi

# Install unattended-upgrades
if ! dpkg -l | grep -q unattended-upgrades; then
    echo -e "${YELLOW}Installing unattended-upgrades...${NC}"
    apt-get update
    apt-get install -y unattended-upgrades apt-listchanges
else
    echo -e "${GREEN}✓ unattended-upgrades already installed${NC}"
fi

# Configure automatic updates
echo -e "${YELLOW}Configuring automatic updates...${NC}"

# Enable automatic updates
cat > /etc/apt/apt.conf.d/20auto-upgrades << 'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Download-Upgradeable-Packages "1";
APT::Periodic::AutocleanInterval "7";
APT::Periodic::Unattended-Upgrade "1";
EOF

# Configure what to update
cat > /etc/apt/apt.conf.d/50unattended-upgrades << 'EOF'
Unattended-Upgrade::Allowed-Origins {
    "${distro_id}:${distro_codename}-security";
    "${distro_id}ESMApps:${distro_codename}-apps-security";
    "${distro_id}ESM:${distro_codename}-infra-security";
};

// Automatically reboot if required (at 3 AM)
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "03:00";

// Email notifications (optional - configure your email)
// Unattended-Upgrade::Mail "admin@yourdomain.com";
// Unattended-Upgrade::MailReport "on-change";

// Remove unused dependencies
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";

// Automatically remove old kernels
Unattended-Upgrade::Remove-New-Unused-Dependencies "true";
EOF

echo -e "${GREEN}✓ Automatic updates configured${NC}\n"

# Test configuration
echo -e "${YELLOW}Testing configuration...${NC}"
unattended-upgrades --dry-run --debug

echo -e "\n${GREEN}=== Automatic Updates Enabled ===${NC}"
echo -e "${GREEN}✓ Security updates will install automatically${NC}"
echo -e "${GREEN}✓ System will auto-reboot at 3 AM if needed${NC}"
echo -e "${GREEN}✓ Old kernels will be removed automatically${NC}"

echo -e "\n${YELLOW}Configuration files:${NC}"
echo -e "  - /etc/apt/apt.conf.d/20auto-upgrades"
echo -e "  - /etc/apt/apt.conf.d/50unattended-upgrades"

echo -e "\n${YELLOW}Useful commands:${NC}"
echo -e "  - View logs: sudo cat /var/log/unattended-upgrades/unattended-upgrades.log"
echo -e "  - Dry run: sudo unattended-upgrades --dry-run"
echo -e "  - Manual trigger: sudo unattended-upgrades"
