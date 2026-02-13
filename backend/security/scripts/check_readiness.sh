#!/bin/bash
###############################################################################
# Pre-Security Check Script
# Purpose: Verify you're ready for SSH hardening
###############################################################################

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}=== Pre-Security Hardening Checklist ===${NC}\n"

READY=true

# Check 1: SSH Keys
echo -e "${BLUE}1. Checking for SSH keys on this server...${NC}"
if [ -f ~/.ssh/authorized_keys ]; then
    KEY_COUNT=$(wc -l < ~/.ssh/authorized_keys)
    echo -e "${GREEN}   ✓ Found $KEY_COUNT SSH key(s) in authorized_keys${NC}"
    echo -e "${YELLOW}   Preview:${NC}"
    head -c 80 ~/.ssh/authorized_keys
    echo "..."
else
    echo -e "${RED}   ✗ No SSH keys found!${NC}"
    echo -e "${YELLOW}   You MUST set up SSH keys before hardening SSH${NC}"
    echo -e "${YELLOW}   See: security/docs/SSH_KEYS_SETUP.md${NC}"
    READY=false
fi

# Check 2: Current SSH config
echo -e "\n${BLUE}2. Checking current SSH configuration...${NC}"
PASSWORD_AUTH=$(sudo grep "^PasswordAuthentication" /etc/ssh/sshd_config | awk '{print $2}')
if [ "$PASSWORD_AUTH" == "yes" ] || [ -z "$PASSWORD_AUTH" ]; then
    echo -e "${YELLOW}   ⚠ Password authentication is currently ENABLED${NC}"
    echo -e "${YELLOW}   (This will be disabled by harden_ssh.sh)${NC}"
else
    echo -e "${GREEN}   ✓ Password authentication already disabled${NC}"
fi

# Check 3: Current user
echo -e "\n${BLUE}3. Checking current user...${NC}"
CURRENT_USER=$(whoami)
echo -e "${GREEN}   ✓ Logged in as: $CURRENT_USER${NC}"

# Check 4: Sudo access
echo -e "\n${BLUE}4. Checking sudo access...${NC}"
if sudo -n true 2>/dev/null; then
    echo -e "${GREEN}   ✓ You have sudo access${NC}"
else
    echo -e "${YELLOW}   ⚠ You may need to enter password for sudo${NC}"
fi

# Check 5: UFW status
echo -e "\n${BLUE}5. Checking firewall status...${NC}"
if command -v ufw &> /dev/null; then
    UFW_STATUS=$(sudo ufw status | grep "Status:" | awk '{print $2}')
    if [ "$UFW_STATUS" == "active" ]; then
        echo -e "${GREEN}   ✓ UFW is already active${NC}"
    else
        echo -e "${YELLOW}   ⚠ UFW is installed but inactive${NC}"
    fi
else
    echo -e "${YELLOW}   ⚠ UFW not installed (will be installed by script)${NC}"
fi

# Check 6: Fail2Ban status
echo -e "\n${BLUE}6. Checking Fail2Ban status...${NC}"
if command -v fail2ban-client &> /dev/null; then
    echo -e "${GREEN}   ✓ Fail2Ban is installed${NC}"
else
    echo -e "${YELLOW}   ⚠ Fail2Ban not installed (will be installed by script)${NC}"
fi

# Check 7: Disk space
echo -e "\n${BLUE}7. Checking disk space...${NC}"
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -lt 80 ]; then
    echo -e "${GREEN}   ✓ Disk usage: ${DISK_USAGE}%${NC}"
else
    echo -e "${RED}   ✗ Disk usage: ${DISK_USAGE}% (too high!)${NC}"
    READY=false
fi

# Summary
echo -e "\n${GREEN}=== Summary ===${NC}"
if [ "$READY" = true ]; then
    echo -e "${GREEN}✓ You appear ready for security hardening!${NC}"
    echo -e "\n${YELLOW}Important Reminders:${NC}"
    echo -e "  1. Test SSH key login from another terminal BEFORE hardening"
    echo -e "  2. Know how to access your cloud provider console"
    echo -e "  3. Keep this terminal open while testing"
    echo -e "\n${BLUE}Next steps:${NC}"
    echo -e "  cd security/scripts"
    echo -e "  sudo ./configure_firewall.sh"
else
    echo -e "${RED}✗ Please fix the issues above before proceeding${NC}"
fi

echo -e "\n${YELLOW}Documentation:${NC}"
echo -e "  SSH Keys: security/docs/SSH_KEYS_SETUP.md"
echo -e "  Cloud Console: security/docs/CLOUD_CONSOLE_ACCESS.md"
echo -e "  Full Guide: security/docs/SECURITY_SETUP.md"
