#!/bin/bash
###############################################################################
# SSH Hardening Script
# Purpose: Disable password authentication and enforce key-based SSH only
# WARNING: Ensure you have SSH keys set up before running this!
###############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=== SSH Hardening Script ===${NC}\n"

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}ERROR: This script must be run as root (use sudo)${NC}"
    exit 1
fi

SSHD_CONFIG="/etc/ssh/sshd_config"
BACKUP_FILE="/etc/ssh/sshd_config.backup.$(date +%Y%m%d_%H%M%S)"

# Create backup
echo -e "${YELLOW}Creating backup of SSH config...${NC}"
cp "$SSHD_CONFIG" "$BACKUP_FILE"
echo -e "${GREEN}Backup saved to: $BACKUP_FILE${NC}\n"

# Check if user has authorized_keys
current_user=$(logname 2>/dev/null || echo $SUDO_USER)
if [ -n "$current_user" ]; then
    auth_keys="/home/$current_user/.ssh/authorized_keys"
    if [ ! -f "$auth_keys" ]; then
        echo -e "${RED}WARNING: No SSH keys found at $auth_keys${NC}"
        echo -e "${YELLOW}You MUST set up SSH keys before disabling password auth!${NC}"
        echo -e "${YELLOW}Run: ssh-copy-id user@server (from your local machine)${NC}\n"
        read -p "Do you have SSH keys set up? (yes/no): " has_keys
        if [ "$has_keys" != "yes" ]; then
            echo -e "${RED}Aborted. Set up SSH keys first!${NC}"
            exit 1
        fi
    else
        echo -e "${GREEN}✓ SSH keys found at $auth_keys${NC}\n"
    fi
fi

# Apply hardening settings
echo -e "${YELLOW}Applying SSH hardening settings...${NC}"

# Function to update or add SSH config setting
update_ssh_config() {
    local key=$1
    local value=$2
    
    if grep -q "^#*${key}" "$SSHD_CONFIG"; then
        # Setting exists (commented or not), replace it
        sed -i "s/^#*${key}.*/${key} ${value}/" "$SSHD_CONFIG"
    else
        # Setting doesn't exist, add it
        echo "${key} ${value}" >> "$SSHD_CONFIG"
    fi
}

# Disable password authentication
update_ssh_config "PasswordAuthentication" "no"
update_ssh_config "ChallengeResponseAuthentication" "no"
update_ssh_config "UsePAM" "no"

# Enable public key authentication
update_ssh_config "PubkeyAuthentication" "yes"

# Disable root login with password (allow with keys only)
update_ssh_config "PermitRootLogin" "prohibit-password"

# Disable empty passwords
update_ssh_config "PermitEmptyPasswords" "no"

# Additional hardening
update_ssh_config "X11Forwarding" "no"
update_ssh_config "MaxAuthTries" "3"
update_ssh_config "MaxSessions" "2"

echo -e "${GREEN}✓ SSH configuration updated${NC}\n"

# Test configuration
echo -e "${YELLOW}Testing SSH configuration...${NC}"
if sshd -t; then
    echo -e "${GREEN}✓ SSH configuration is valid${NC}\n"
else
    echo -e "${RED}ERROR: SSH configuration test failed!${NC}"
    echo -e "${YELLOW}Restoring backup...${NC}"
    cp "$BACKUP_FILE" "$SSHD_CONFIG"
    echo -e "${GREEN}Backup restored. No changes applied.${NC}"
    exit 1
fi

# Show changes
echo -e "${YELLOW}Changes made:${NC}"
grep -E "^(PasswordAuthentication|PubkeyAuthentication|PermitRootLogin|ChallengeResponseAuthentication)" "$SSHD_CONFIG"

# Final confirmation
echo -e "\n${RED}WARNING: This will disable password-based SSH login!${NC}"
echo -e "${YELLOW}Make sure you can log in with SSH keys before proceeding.${NC}"
echo -e "${YELLOW}Test in another terminal: ssh $(whoami)@localhost${NC}\n"
read -p "Apply changes and restart SSH? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo -e "${YELLOW}Aborted. Restoring backup...${NC}"
    cp "$BACKUP_FILE" "$SSHD_CONFIG"
    echo -e "${GREEN}No changes applied.${NC}"
    exit 0
fi

# Restart SSH service
echo -e "\n${GREEN}Restarting SSH service...${NC}"
systemctl restart sshd || systemctl restart ssh

echo -e "\n${GREEN}=== SSH Hardening Complete ===${NC}"
echo -e "${GREEN}✓ Password authentication disabled${NC}"
echo -e "${GREEN}✓ Key-based authentication enforced${NC}"
echo -e "\n${YELLOW}Important:${NC}"
echo -e "  - Test SSH login from another terminal NOW"
echo -e "  - Backup location: $BACKUP_FILE"
echo -e "  - To rollback: sudo cp $BACKUP_FILE $SSHD_CONFIG && sudo systemctl restart sshd"
