from django.contrib.auth import get_user_model
import os
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
        print(f"✅ {status} user: {email} (Password: {password})")
    except Exception as e:
        print(f"❌ Failed to create user {email}: {e}")

# Admin Account
create_user('demo@example.com', 'demo', 'DemoPass123!', True)

# Regular Account
create_user('user@example.com', 'user', 'UserPass123!', False)
