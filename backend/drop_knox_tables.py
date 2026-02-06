#!/usr/bin/env python
"""Drop and recreate Knox tables"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.db import connection

with connection.cursor() as cursor:
    # Drop Knox tables
    cursor.execute("DROP TABLE IF EXISTS knox_authtoken CASCADE;")
    print("Dropped knox_authtoken table")
    
print("Knox tables dropped. Now run: python manage.py migrate knox")
