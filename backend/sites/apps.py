from django.apps import AppConfig


class SitesConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'sites'
    label = 'wordpress_sites'  # Avoid conflict with django.contrib.sites
