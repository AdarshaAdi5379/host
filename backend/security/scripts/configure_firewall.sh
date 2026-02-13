#!/bin/bash
###############################################################################
# SSH Firewall Configuration Script
# Purpose: Configure UFW (Uncomplicated Firewall) for server hardening
# WARNING: This script will enable the firewall. Ensure SSH access is working!
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== UFW Firewall Configuration ===${NC}\n"

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}ERROR: This script must be run as root (use sudo)${NC}"
    exit 1
fi

# Check if UFW is installed
if ! command -v ufw &> /dev/null; then
    echo -e "${YELLOW}UFW not found. Installing...${NC}"
    apt-get update
    apt-get install -y ufw
fi

echo -e "${YELLOW}Current UFW status:${NC}"
ufw status verbose

echo -e "\n${YELLOW}Configuring firewall rules...${NC}"

# Reset UFW to default state (optional - comment out if you want to preserve existing rules)
# ufw --force reset

# Set default policies
echo "Setting default policies..."
ufw default deny incoming
ufw default allow outgoing

# Allow SSH (CRITICAL - prevents lockout)
echo "Allowing SSH (port 22)..."
ufw limit ssh comment 'SSH with rate limiting'

# Optional: Allow specific IP for SSH (uncomment and set YOUR_IP)
# YOUR_IP="203.0.113.1"
# ufw allow from $YOUR_IP to any port 22 proto tcp comment 'SSH from trusted IP'

# Optional: Allow HTTP/HTTPS if you're running a web server directly (not recommended with Cloudflare Tunnel)
# ufw allow 80/tcp comment 'HTTP'
# ufw allow 443/tcp comment 'HTTPS'

# Enable logging
echo "Enabling firewall logging..."
ufw logging on

# Show what will be enabled
echo -e "\n${YELLOW}Firewall rules to be applied:${NC}"
ufw show added

# Confirmation prompt
echo -e "\n${RED}WARNING: About to enable firewall!${NC}"
echo -e "${YELLOW}Make sure you can SSH into this server before proceeding.${NC}"
read -p "Continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo -e "${YELLOW}Aborted. No changes made.${NC}"
    exit 0
fi

# Enable firewall
echo -e "\n${GREEN}Enabling UFW...${NC}"
ufw --force enable

# Show final status
echo -e "\n${GREEN}=== Firewall Configuration Complete ===${NC}"
ufw status verbose

echo -e "\n${GREEN}✓ Firewall is now active${NC}"
echo -e "${YELLOW}Important:${NC}"
echo -e "  - Test SSH access from another terminal before closing this one"
echo -e "  - To disable: sudo ufw disable"
echo -e "  - To check status: sudo ufw status verbose"
echo -e "  - To view logs: sudo tail -f /var/log/ufw.log"
