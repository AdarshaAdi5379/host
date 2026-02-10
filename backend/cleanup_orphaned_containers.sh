#!/bin/bash
# Cleanup script for orphaned WordPress containers
# This script stops and removes containers that are not tracked in the database

echo "🔍 Finding orphaned WordPress containers..."
echo ""

# Get list of sites tracked in database
echo "📊 Sites tracked in database:"
python manage.py shell -c "from sites.models import WordPressSite; [print(s.name) for s in WordPressSite.objects.all()]" > /tmp/tracked_sites.txt
cat /tmp/tracked_sites.txt
echo ""

# Get all WordPress containers
echo "🐳 All running WordPress containers:"
docker ps --filter "name=_wp" --filter "name=_mysql" --format "{{.Names}}" | sed 's/_wp$//' | sed 's/_mysql$//' | sort -u > /tmp/all_containers.txt
cat /tmp/all_containers.txt
echo ""

# Find orphaned containers (containers not in database)
echo "🗑️  Orphaned containers (will be removed):"
comm -23 /tmp/all_containers.txt /tmp/tracked_sites.txt > /tmp/orphaned.txt
cat /tmp/orphaned.txt
echo ""

# Count orphaned containers
ORPHAN_COUNT=$(wc -l < /tmp/orphaned.txt)
echo "Found $ORPHAN_COUNT orphaned site(s)"
echo ""

if [ $ORPHAN_COUNT -eq 0 ]; then
    echo "✅ No orphaned containers found. All clean!"
    exit 0
fi

# Confirm deletion
read -p "⚠️  Do you want to delete these containers? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "❌ Cleanup cancelled."
    exit 0
fi

echo ""
echo "🧹 Starting cleanup..."
echo ""

# Stop and remove orphaned containers
while IFS= read -r site_name; do
    if [ -n "$site_name" ]; then
        echo "Removing: $site_name"
        
        # Stop and remove WordPress container
        if docker ps -a --format "{{.Names}}" | grep -q "^${site_name}_wp$"; then
            echo "  - Stopping ${site_name}_wp..."
            docker stop "${site_name}_wp" 2>/dev/null
            echo "  - Removing ${site_name}_wp..."
            docker rm "${site_name}_wp" 2>/dev/null
        fi
        
        # Stop and remove MySQL container
        if docker ps -a --format "{{.Names}}" | grep -q "^${site_name}_mysql$"; then
            echo "  - Stopping ${site_name}_mysql..."
            docker stop "${site_name}_mysql" 2>/dev/null
            echo "  - Removing ${site_name}_mysql..."
            docker rm "${site_name}_mysql" 2>/dev/null
        fi
        
        # Remove site directory if exists
        SITE_DIR="wordpress_sites/${site_name}"
        if [ -d "$SITE_DIR" ]; then
            echo "  - Removing directory: $SITE_DIR"
            rm -rf "$SITE_DIR"
        fi
        
        echo "  ✅ ${site_name} cleaned up"
        echo ""
    fi
done < /tmp/orphaned.txt

# Cleanup temp files
rm -f /tmp/tracked_sites.txt /tmp/all_containers.txt /tmp/orphaned.txt

echo "✨ Cleanup complete!"
echo ""
echo "📊 Summary:"
docker ps --filter "name=_wp" --filter "name=_mysql" --format "table {{.Names}}\t{{.Status}}" | head -20
