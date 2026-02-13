#!/bin/bash
###############################################################################
# Container Restart Script (Alternative Method)
# Purpose: Restart WordPress containers using down/up to avoid Docker bug
###############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}=== Restarting WordPress Containers (Down/Up Method) ===${NC}"
echo -e "${YELLOW}Applying secure port bindings (127.0.0.1)...${NC}\n"

# Base directory
BASE_DIR="/home/adarsha/Desktop/projects/HOST/host/backend/wordpress_sites"

# List of sites to restart
SITES=(
    "test17"
    "test33"
    "test34"
    "test36"
    "test37"
    "test38"
    "test39"
    "test40"
    "test41"
    "test42"
    "test43"
    "35"
)

SUCCESS_COUNT=0
FAIL_COUNT=0
FAILED_SITES=()

for site in "${SITES[@]}"; do
    echo -e "${BLUE}Restarting: $site${NC}"
    
    SITE_DIR="$BASE_DIR/$site"
    
    if [ ! -d "$SITE_DIR" ]; then
        echo -e "${RED}  ✗ Directory not found: $SITE_DIR${NC}"
        ((FAIL_COUNT++))
        FAILED_SITES+=("$site (directory not found)")
        continue
    fi
    
    cd "$SITE_DIR"
    
    # Stop and remove containers
    docker-compose down > /dev/null 2>&1
    
    # Start with new configuration
    if docker-compose up -d > /dev/null 2>&1; then
        echo -e "${GREEN}  ✓ Successfully restarted${NC}\n"
        ((SUCCESS_COUNT++))
    else
        echo -e "${RED}  ✗ Failed to restart${NC}\n"
        ((FAIL_COUNT++))
        FAILED_SITES+=("$site")
    fi
done

echo -e "\n${GREEN}=== Summary ===${NC}"
echo -e "  ${GREEN}Success: $SUCCESS_COUNT${NC}"
echo -e "  ${RED}Failed: $FAIL_COUNT${NC}"

if [ $FAIL_COUNT -gt 0 ]; then
    echo -e "\n${RED}Failed sites:${NC}"
    for failed in "${FAILED_SITES[@]}"; do
        echo -e "  - $failed"
    done
fi

echo -e "\n${YELLOW}Verification:${NC}"
echo -e "  Run: sudo netstat -tlnp | grep docker-proxy | grep 127.0.0.1"
echo -e "  All ports should show 127.0.0.1:PORT (not 0.0.0.0:PORT)"
