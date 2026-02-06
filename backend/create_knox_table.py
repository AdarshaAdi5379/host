#!/usr/bin/env python
"""Manually create Knox auth token table"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.db import connection

with connection.cursor() as cursor:
    # Create knox_authtoken table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS knox_authtoken (
            digest VARCHAR(128) PRIMARY KEY,
            token_key VARCHAR(8) NOT NULL,
            created TIMESTAMP WITH TIME ZONE NOT NULL,
            user_id INTEGER NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
            expiry TIMESTAMP WITH TIME ZONE NULL,
            UNIQUE (token_key)
        );
    """)
    print("Created knox_authtoken table")
    
    # Create index on user_id for performance
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS knox_authtoken_user_id_idx 
        ON knox_authtoken(user_id);
    """)
    print("Created index on user_id")
    
print("Knox table created successfully!")
