import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from sites.models import WordPressSite

# Update test40
site40 = WordPressSite.objects.get(id=8)
site40.filebrowser_username = 'fb_test40'
site40.filebrowser_password = 'Sx9nL6pM3rK7vT4w'
site40.save()
print(f'✅ Updated {site40.name}')

# Update test41
site41 = WordPressSite.objects.get(id=9)
site41.filebrowser_username = 'fb_test41'
site41.filebrowser_password = 'Tx8mK5nP2vL9wR6q'
site41.save()
print(f'✅ Updated {site41.name}')

print('\n✅ All credentials updated!')
