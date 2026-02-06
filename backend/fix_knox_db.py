#!/usr/bin/env python
"""Fix corrupted Knox auth token table"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.db import connection

with connection.cursor() as cursor:
    # Delete all rows from knox_authtoken table
    cursor.execute("DELETE FROM knox_authtoken;")
    print(f"Deleted all rows from knox_authtoken table")
    
    # Check if there are any rows left
    cursor.execute("SELECT COUNT(*) FROM knox_authtoken;")
    count = cursor.fetchone()[0]
    print(f"Remaining rows: {count}")
    
print("Knox database fixed successfully!")
