from django.apps import AppConfig


class SitesConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'sites'
    label = 'wordpress_sites'  # Avoid conflict with django.contrib.sites

    def ready(self):
        """Import signals and start the Cloudflare tunnel when Django is ready."""
        import sites.signals  # noqa

        # ── Auto-start Cloudflare Tunnel ──────────────────────────────
        # Skip during management commands that don't run the HTTP server
        # (migrate, collectstatic, shell, etc.)
        import sys
        _SKIP_COMMANDS = {
            'migrate', 'makemigrations', 'collectstatic', 'shell',
            'createsuperuser', 'dbshell', 'dumpdata', 'loaddata',
            'test', 'check',
            'run_gateway_worker', 'run_compute_worker', 'reconcile_compute_state',
        }
        argv = sys.argv
        if len(argv) >= 2 and argv[1] in _SKIP_COMMANDS:
            return

        from django.conf import settings
        from sites import cloudflared_runner

        config_path = getattr(settings, 'CLOUDFLARE_CONFIG_PATH', None)
        if config_path:
            cloudflared_runner.start(config_path)
