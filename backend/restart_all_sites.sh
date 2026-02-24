#!/bin/bash
# Restart all tracked WordPress site containers

cd /home/adarsha/Desktop/projects/HOST/host/backend

# Get all sites and their directories from Django
python manage.py shell -c "
from sites.models import WordPressSite
sites = WordPressSite.objects.exclude(site_directory='').exclude(site_directory__isnull=True)
for s in sites:
    print(f'{s.name}|{s.site_directory}')
" > /tmp/sites_list.txt

echo "Restarting all WordPress containers..."

while IFS='|' read -r name dir; do
    if [ -z "$dir" ] || [ ! -f "$dir/docker-compose.yml" ]; then
        echo "  Skipping $name (no docker-compose.yml)"
        continue
    fi

    echo "  Starting $name at $dir..."
    docker compose -f "$dir/docker-compose.yml" up -d 2>&1 | tail -3
    echo "  Done: $name"
done < /tmp/sites_list.txt

echo ""
echo "Currently running containers:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

rm -f /tmp/sites_list.txt
