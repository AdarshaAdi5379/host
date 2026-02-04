#!/bin/bash
# Setup automated S3 backups via cron
# This script configures daily backups at 3:00 AM IST

set -e

echo "========================================================================"
echo "  S3 Backup Cron Setup"
echo "========================================================================"
echo ""

# Get absolute paths
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_ROOT/backend"
PYTHON_PATH=$(which python)
LOG_DIR="/var/log/hostinger"

echo "Project root: $PROJECT_ROOT"
echo "Backend dir:  $BACKEND_DIR"
echo "Python path:  $PYTHON_PATH"
echo ""

# Create log directory
echo "Creating log directory..."
sudo mkdir -p "$LOG_DIR"
sudo chown $USER:$USER "$LOG_DIR"
echo "✓ Log directory created: $LOG_DIR"
echo ""

# Create cron job
CRON_CMD="0 3 * * * cd $BACKEND_DIR && $PYTHON_PATH manage.py backup_all >> $LOG_DIR/s3-backups.log 2>&1"

echo "Adding cron job..."
echo "Schedule: Daily at 3:00 AM IST"
echo "Command:  $CRON_CMD"
echo ""

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "backup_all"; then
    echo "⚠ Backup cron job already exists. Removing old entry..."
    crontab -l 2>/dev/null | grep -v "backup_all" | crontab -
fi

# Add new cron job
(crontab -l 2>/dev/null; echo "$CRON_CMD") | crontab -

echo "✓ Cron job added successfully"
echo ""

# Verify cron job
echo "Current cron jobs:"
echo "------------------------------------------------------------------------"
crontab -l | grep "backup_all" || echo "No backup jobs found"
echo "------------------------------------------------------------------------"
echo ""

# Test backup command
echo "Testing backup command (dry-run)..."
cd "$BACKEND_DIR"
$PYTHON_PATH manage.py backup_all --dry-run

echo ""
echo "========================================================================"
echo "  Setup Complete!"
echo "========================================================================"
echo ""
echo "Next steps:"
echo "  1. Configure AWS credentials in backend/.env"
echo "  2. Test backup: python manage.py backup_all --site <site_name>"
echo "  3. Monitor logs: tail -f $LOG_DIR/s3-backups.log"
echo ""
echo "To remove cron job:"
echo "  crontab -e  # Then delete the backup_all line"
echo ""
