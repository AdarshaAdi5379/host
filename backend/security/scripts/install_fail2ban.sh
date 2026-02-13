#!/bin/bash
###############################################################################
# Fail2Ban Installation and Configuration Script
# Purpose: Install and configure Fail2Ban for intrusion detection
# Protects against: SSH brute force, port scans, repeated failed logins
###############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=== Fail2Ban Installation & Configuration ===${NC}\n"

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}ERROR: This script must be run as root (use sudo)${NC}"
    exit 1
fi

# Install Fail2Ban
if ! command -v fail2ban-client &> /dev/null; then
    echo -e "${YELLOW}Installing Fail2Ban...${NC}"
    apt-get update
    apt-get install -y fail2ban
else
    echo -e "${GREEN}✓ Fail2Ban already installed${NC}"
fi

# Create local configuration
JAIL_LOCAL="/etc/fail2ban/jail.local"

if [ -f "$JAIL_LOCAL" ]; then
    echo -e "${YELLOW}Backing up existing jail.local...${NC}"
    cp "$JAIL_LOCAL" "${JAIL_LOCAL}.backup.$(date +%Y%m%d_%H%M%S)"
fi

echo -e "${YELLOW}Creating Fail2Ban configuration...${NC}"

cat > "$JAIL_LOCAL" << 'EOF'
[DEFAULT]
# Ban hosts for 1 hour (3600 seconds)
bantime = 3600

# A host is banned if it has generated "maxretry" during the last "findtime"
findtime = 600

# Number of failures before a host gets banned
maxretry = 3

# Email notifications (optional - configure your email)
# destemail = admin@yourdomain.com
# sendername = Fail2Ban
# action = %(action_mwl)s

###############################################################################
# SSH Protection
###############################################################################
[sshd]
enabled = true
port = ssh
logpath = %(sshd_log)s
backend = %(sshd_backend)s
maxretry = 3
bantime = 3600
findtime = 600

# Aggressive mode - ban after fewer attempts
[sshd-aggressive]
enabled = false
port = ssh
logpath = %(sshd_log)s
maxretry = 2
bantime = 86400  # 24 hours
findtime = 300   # 5 minutes

###############################################################################
# Additional Protections (Optional - enable as needed)
###############################################################################

# Protect against port scanning
[port-scan]
enabled = false
logpath = /var/log/syslog
maxretry = 5
bantime = 86400

# Protect Nginx (if you're using it directly)
[nginx-http-auth]
enabled = false
port = http,https
logpath = /var/log/nginx/error.log

[nginx-noscript]
enabled = false
port = http,https
logpath = /var/log/nginx/access.log

# Protect against DoS
[nginx-req-limit]
enabled = false
port = http,https
logpath = /var/log/nginx/error.log
maxretry = 10
findtime = 60
bantime = 3600
EOF

echo -e "${GREEN}✓ Configuration created at $JAIL_LOCAL${NC}\n"

# Enable and start Fail2Ban
echo -e "${YELLOW}Enabling Fail2Ban service...${NC}"
systemctl enable fail2ban
systemctl restart fail2ban

# Wait for service to start
sleep 2

# Show status
echo -e "\n${GREEN}=== Fail2Ban Status ===${NC}"
fail2ban-client status

echo -e "\n${GREEN}=== SSH Jail Status ===${NC}"
fail2ban-client status sshd || echo "SSH jail not yet active"

echo -e "\n${GREEN}✓ Fail2Ban installation complete${NC}"
echo -e "\n${YELLOW}Useful Commands:${NC}"
echo -e "  - Check status: sudo fail2ban-client status"
echo -e "  - Check SSH jail: sudo fail2ban-client status sshd"
echo -e "  - Unban IP: sudo fail2ban-client set sshd unbanip <IP>"
echo -e "  - View logs: sudo tail -f /var/log/fail2ban.log"
echo -e "  - Test config: sudo fail2ban-client -t"
