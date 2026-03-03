"""
Django management command: rds_failover
Manage per-site RDS DR configuration and execute failover/failback.
"""
import json

from django.core.management.base import BaseCommand, CommandError

from sites.models import WordPressSite
from sites.rds_failover_manager import RDSFailoverManager


class Command(BaseCommand):
    help = "Configure and operate RDS failover for single-site or shared-RDS mode"

    def add_arguments(self, parser):
        parser.add_argument("--site", help="Site name (or numeric site id)")
        parser.add_argument(
            "--action",
            required=True,
            choices=[
                "status",
                "configure",
                "test",
                "plan",
                "failover",
                "failback",
                "configure_shared",
                "shared_plan",
            ],
            help="Operation to run",
        )

        # Config fields (used with --action configure)
        parser.add_argument("--enabled", choices=["true", "false"], help="Enable/disable RDS failover")
        parser.add_argument("--rds-endpoint", help="RDS endpoint hostname")
        parser.add_argument("--rds-port", type=int, help="RDS port (default 3306)")
        parser.add_argument("--rds-database", help="RDS database/schema name")
        parser.add_argument("--rds-username", help="RDS username")
        parser.add_argument("--rds-password", help="RDS password")
        parser.add_argument("--source-public-host", help="Local source public IP/DNS for replication")
        parser.add_argument("--source-public-port", type=int, help="Local source public MySQL port")
        parser.add_argument("--replication-user", help="Replication username on local source")
        parser.add_argument("--replication-password", help="Replication password on local source")
        parser.add_argument(
            "--rds-ssl-required",
            choices=["true", "false"],
            help="Whether SSL/TLS should be required for RDS replication setup",
        )
        parser.add_argument(
            "--no-promote",
            action="store_true",
            help="Failover only rewrites app DB target; skip RDS stop/reset promotion attempts",
        )
        parser.add_argument(
            "--database-template",
            default="wp_{site_name}",
            help="DB name template for shared-RDS actions (default: wp_{site_name})",
        )
        parser.add_argument(
            "--write-shared-plan-file",
            help="Optional output file path for shared SQL plan",
        )

    @staticmethod
    def _to_bool(value: str) -> bool:
        return str(value).strip().lower() in {"1", "true", "yes", "y"}

    def _resolve_site(self, value: str) -> WordPressSite:
        if value.isdigit():
            try:
                return WordPressSite.objects.get(id=int(value))
            except WordPressSite.DoesNotExist as exc:
                raise CommandError(f"Site with id={value} not found") from exc

        try:
            return WordPressSite.objects.get(name=value)
        except WordPressSite.DoesNotExist as exc:
            raise CommandError(f"Site '{value}' not found") from exc

    def handle(self, *args, **options):
        action = options["action"]
        manager = RDSFailoverManager()

        # Actions operating across many sites
        if action in {"configure_shared", "shared_plan"}:
            return self._handle_shared_actions(manager, options)

        site_opt = options.get("site")
        if not site_opt:
            raise CommandError("--site is required for this action")
        site = self._resolve_site(site_opt)

        if action == "status":
            config = manager.get_config(site, redact=True)
            self.stdout.write(json.dumps(config, indent=2))
            return

        if action == "configure":
            payload = {}
            key_map = {
                "rds_endpoint": "rds_endpoint",
                "rds_port": "rds_port",
                "rds_database": "rds_database",
                "rds_username": "rds_username",
                "rds_password": "rds_password",
                "source_public_host": "source_public_host",
                "source_public_port": "source_public_port",
                "replication_user": "replication_user",
                "replication_password": "replication_password",
            }
            for opt_key, payload_key in key_map.items():
                value = options.get(opt_key)
                if value is not None:
                    payload[payload_key] = value

            if options.get("enabled") is not None:
                payload["enabled"] = self._to_bool(options["enabled"])
            if options.get("rds_ssl_required") is not None:
                payload["rds_ssl_required"] = self._to_bool(options["rds_ssl_required"])

            if not payload:
                raise CommandError("No configuration fields provided.")

            config = manager.update_config(site, payload)
            self.stdout.write(self.style.SUCCESS("RDS failover config updated."))
            self.stdout.write(json.dumps(config, indent=2))
            return

        if action == "test":
            ok, message = manager.test_rds_connection(site)
            if ok:
                self.stdout.write(self.style.SUCCESS(message))
                return
            raise CommandError(message)

        if action == "plan":
            plan = manager.get_replication_plan(site)
            self.stdout.write(json.dumps(plan, indent=2))
            return

        if action == "failover":
            ok, message, docker_output = manager.failover_to_rds(site, promote_rds=not options["no_promote"])
            if ok:
                self.stdout.write(self.style.SUCCESS(message))
                if docker_output:
                    self.stdout.write(docker_output.strip()[:1200])
                return
            raise CommandError(message)

        if action == "failback":
            ok, message, docker_output = manager.failback_to_local(site)
            if ok:
                self.stdout.write(self.style.SUCCESS(message))
                if docker_output:
                    self.stdout.write(docker_output.strip()[:1200])
                return
            raise CommandError(message)

    def _build_shared_payload(self, options):
        payload = {}
        key_map = {
            "rds_endpoint": "rds_endpoint",
            "rds_port": "rds_port",
            "rds_username": "rds_username",
            "rds_password": "rds_password",
            "source_public_host": "source_public_host",
            "source_public_port": "source_public_port",
            "replication_user": "replication_user",
            "replication_password": "replication_password",
        }
        for opt_key, payload_key in key_map.items():
            value = options.get(opt_key)
            if value is not None:
                payload[payload_key] = value

        if options.get("enabled") is not None:
            payload["enabled"] = self._to_bool(options["enabled"])
        if options.get("rds_ssl_required") is not None:
            payload["rds_ssl_required"] = self._to_bool(options["rds_ssl_required"])
        return payload

    @staticmethod
    def _render_db_name(template: str, site_name: str, site_id: int) -> str:
        try:
            raw = template.format(site_name=site_name, site_id=site_id)
        except KeyError as exc:
            missing = str(exc).strip("'")
            raise CommandError(
                "Invalid --database-template placeholder: "
                f"'{missing}'. Allowed placeholders are {{site_name}} and {{site_id}}."
            ) from exc
        cleaned = "".join(ch if (ch.isalnum() or ch == "_") else "_" for ch in raw.lower())
        if len(cleaned) > 64:
            cleaned = cleaned[:64]
        return cleaned

    def _handle_shared_actions(self, manager: RDSFailoverManager, options):
        template = options.get("database_template") or "wp_{site_name}"
        sites = list(WordPressSite.objects.order_by("id"))
        if not sites:
            raise CommandError("No sites found.")

        shared_payload = self._build_shared_payload(options)

        if options["action"] == "configure_shared":
            if not shared_payload:
                raise CommandError("No shared configuration fields provided.")

            updated = []
            for site in sites:
                payload = dict(shared_payload)
                payload["rds_database"] = self._render_db_name(template, site.name, site.id)
                config = manager.update_config(site, payload)
                updated.append(
                    {
                        "site": site.name,
                        "rds_database": config.get("rds_database"),
                        "rds_endpoint": config.get("rds_endpoint"),
                        "enabled": config.get("enabled"),
                    }
                )

            self.stdout.write(self.style.SUCCESS(f"Configured shared RDS settings for {len(updated)} site(s)."))
            self.stdout.write(json.dumps(updated, indent=2))
            return

        if options["action"] == "shared_plan":
            endpoint = options.get("rds_endpoint")
            username = options.get("rds_username")
            password = options.get("rds_password")
            if not endpoint or not username:
                raise CommandError("--rds-endpoint and --rds-username are required for shared_plan")

            sql_lines = [
                "-- Shared RDS bootstrap plan (review before execution)",
                f"-- endpoint: {endpoint}",
                "SET sql_log_bin = 0;",
                f"CREATE USER IF NOT EXISTS '{username}'@'%' IDENTIFIED BY '<REDACTED_OR_SET_PASSWORD>';",
            ]
            if password:
                sql_lines.append(f"ALTER USER '{username}'@'%' IDENTIFIED BY '{password}';")

            plan_items = []
            for site in sites:
                db_name = self._render_db_name(template, site.name, site.id)
                sql_lines.append(f"CREATE DATABASE IF NOT EXISTS `{db_name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;")
                sql_lines.append(f"GRANT ALL PRIVILEGES ON `{db_name}`.* TO '{username}'@'%';")
                plan_items.append({"site": site.name, "rds_database": db_name})

            sql_lines.append("FLUSH PRIVILEGES;")
            payload = {
                "database_template": template,
                "site_count": len(sites),
                "mappings": plan_items,
                "sql": sql_lines,
            }
            output_path = options.get("write_shared_plan_file")
            if output_path:
                from pathlib import Path

                path = Path(output_path)
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text("\n".join(sql_lines) + "\n")
                payload["written_to"] = str(path)

            self.stdout.write(json.dumps(payload, indent=2))
            return
