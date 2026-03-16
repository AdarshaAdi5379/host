import os
import sys
from typing import Optional

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from sites.models import WordPressSite


def env_required(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        print(f"Missing required env var: {name}")
        sys.exit(1)
    return value


def update_site(site_id: int, username_env: str, password_env: str) -> Optional[str]:
    username = env_required(username_env)
    password = env_required(password_env)
    site = WordPressSite.objects.get(id=site_id)
    site.filebrowser_username = username
    site.filebrowser_password = password
    site.save(update_fields=["filebrowser_username", "filebrowser_password"])
    return site.name


if __name__ == "__main__":
    """
    Usage:
      TEST40_FB_USERNAME=... TEST40_FB_PASSWORD=... \
      TEST41_FB_USERNAME=... TEST41_FB_PASSWORD=... \
      python backend/update_test40_test41_creds.py
    """
    name40 = update_site(8, "TEST40_FB_USERNAME", "TEST40_FB_PASSWORD")
    print(f"Updated {name40}")
    name41 = update_site(9, "TEST41_FB_USERNAME", "TEST41_FB_PASSWORD")
    print(f"Updated {name41}")
    print("All credentials updated")
