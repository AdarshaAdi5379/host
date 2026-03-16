import os
import django
import json
import sys
from django.conf import settings

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.test import RequestFactory
from dj_rest_auth.views import LoginView

factory = RequestFactory()
email = os.getenv("DEBUG_LOGIN_EMAIL", "").strip()
password = os.getenv("DEBUG_LOGIN_PASSWORD", "").strip()

if not email or not password:
    print(
        "Missing required env vars.\n"
        "Usage:\n"
        "  DEBUG_LOGIN_EMAIL='user@example.com' \\\n"
        "  DEBUG_LOGIN_PASSWORD='<password>' \\\n"
        "  python backend/debug_login.py"
    )
    sys.exit(1)

data = {"email": email, "password": password}
request = factory.post('/api/auth/login/', data, content_type='application/json')

try:
    view = LoginView.as_view()
    response = view(request)
    print(f"Status Code: {response.status_code}")
    if hasattr(response, 'data'):
        print(f"Data: {response.data}")
    else:
        print(f"Content: {response.content}")
except Exception as e:
    import traceback
    traceback.print_exc()
