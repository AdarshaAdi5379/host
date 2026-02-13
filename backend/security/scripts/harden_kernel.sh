#!/bin/bash
###############################################################################
# Kernel Hardening Script
# Purpose: Apply sysctl security settings for network hardening
# Includes: ICMP blocking, IP spoofing prevention, and other protections
###############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=== Kernel Security Hardening ===${NC}\n"

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}ERROR: This script must be run as root (use sudo)${NC}"
    exit 1
fi

SYSCTL_CONF="/etc/sysctl.conf"
BACKUP_FILE="/etc/sysctl.conf.backup.$(date +%Y%m%d_%H%M%S)"

# Create backup
echo -e "${YELLOW}Creating backup of sysctl.conf...${NC}"
cp "$SYSCTL_CONF" "$BACKUP_FILE"
echo -e "${GREEN}Backup saved to: $BACKUP_FILE${NC}\n"

# Security settings to apply
echo -e "${YELLOW}Applying kernel hardening settings...${NC}"

cat >> "$SYSCTL_CONF" << 'EOF'

###############################################################################
# Security Hardening Settings (Added by security script)
###############################################################################

# Ignore ICMP ping requests (Stealth Mode)
net.ipv4.icmp_echo_ignore_all = 1

# Prevent IP spoofing
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1

# Ignore ICMP redirects
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv6.conf.all.accept_redirects = 0
net.ipv6.conf.default.accept_redirects = 0

# Disable source packet routing
net.ipv4.conf.all.accept_source_route = 0
net.ipv4.conf.default.accept_source_route = 0
net.ipv6.conf.all.accept_source_route = 0
net.ipv6.conf.default.accept_source_route = 0

# Log suspicious packets (Martian packets)
net.ipv4.conf.all.log_martians = 1
net.ipv4.conf.default.log_martians = 1

# Ignore ICMP broadcast requests
net.ipv4.icmp_echo_ignore_broadcasts = 1

# Ignore bogus ICMP error responses
net.ipv4.icmp_ignore_bogus_error_responses = 1

# Enable TCP SYN cookies (DDoS protection)
net.ipv4.tcp_syncookies = 1

# Disable IPv6 if not needed (optional - comment out if you use IPv6)
# net.ipv6.conf.all.disable_ipv6 = 1
# net.ipv6.conf.default.disable_ipv6 = 1

EOF

echo -e "${GREEN}✓ Settings added to $SYSCTL_CONF${NC}\n"

# Apply settings
echo -e "${YELLOW}Applying settings...${NC}"
sysctl -p

echo -e "\n${GREEN}=== Kernel Hardening Complete ===${NC}"
echo -e "${GREEN}✓ ICMP ping disabled (server appears offline)${NC}"
echo -e "${GREEN}✓ IP spoofing protection enabled${NC}"
echo -e "${GREEN}✓ ICMP redirect protection enabled${NC}"
echo -e "${GREEN}✓ Source routing disabled${NC}"
echo -e "${GREEN}✓ Suspicious packet logging enabled${NC}"
echo -e "${GREEN}✓ TCP SYN cookies enabled${NC}"

echo -e "\n${YELLOW}Verification:${NC}"
echo -e "  - Test ping from external machine: ping $(hostname -I | awk '{print $1}')"
echo -e "  - Expected: Request timeout (100% packet loss)"
echo -e "  - View logs: sudo tail -f /var/log/kern.log"
echo -e "\n${YELLOW}Rollback:${NC}"
echo -e "  - sudo cp $BACKUP_FILE $SYSCTL_CONF"
echo -e "  - sudo sysctl -p"
