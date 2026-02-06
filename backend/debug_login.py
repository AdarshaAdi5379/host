import os
import django
import json
from django.conf import settings

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.test import RequestFactory
from dj_rest_auth.views import LoginView

factory = RequestFactory()
data = {"email": "demo@example.com", "password": "DemoPass123!"}
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
