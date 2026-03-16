from django.contrib.auth import get_user_model
import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

User = get_user_model()

def create_user(email, username, password, is_staff=False):
    try:
        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                'username': username,
                'is_staff': is_staff,
                'is_superuser': is_staff
            }
        )
        user.set_password(password)
        user.save()
        status = "Created" if created else "Updated"
        print(f"✅ {status} user: {email}")
    except Exception as e:
        print(f"❌ Failed to create user {email}: {e}")

admin_password = os.getenv('DEMO_ADMIN_PASSWORD', '').strip()
user_password = os.getenv('DEMO_USER_PASSWORD', '').strip()

if not admin_password or not user_password:
    print(
        "Missing required env vars.\n"
        "Usage:\n"
        "  DEMO_ADMIN_PASSWORD='<strong-password>' \\\n"
        "  DEMO_USER_PASSWORD='<strong-password>' \\\n"
        "  python backend/create_demo_users.py"
    )
    sys.exit(1)

# Admin Account
create_user('demo@example.com', 'demo', admin_password, True)

# Regular Account
create_user('user@example.com', 'user', user_password, False)
