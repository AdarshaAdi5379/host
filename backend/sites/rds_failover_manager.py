"""
RDS Failover Manager
Handles per-site RDS DR configuration, health checks, failover and failback.
"""
from __future__ import annotations

import copy
import re
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

import yaml
from django.utils import timezone

from .docker_utils import run_docker_compose_up
from .models import WordPressSite


class RDSFailoverManager:
    """
    Manage RDS DR state for a WordPressSite.

    Notes:
    - This manager intentionally keeps replication bootstrap as an operator-guided
      workflow because exact RDS stored procedures differ by engine/version.
    - Failover/failback runtime steps are automated.
    """

    DEFAULT_CONFIG: Dict[str, Any] = {
        "enabled": False,
        "active_target": "local",  # local | rds
        "rds_endpoint": "",
        "rds_port": 3306,
        "rds_database": "wordpress",
        "rds_username": "",
        "rds_password": "",
        "rds_ssl_required": True,
        "source_public_host": "",
        "source_public_port": 3306,
        "replication_user": "replicator",
        "replication_password": "",
        "replication_state": "not_configured",  # not_configured | configured | running | error | promoted
        "replication_last_error": "",
        "last_failover_at": "",
        "last_failback_at": "",
    }

    EDITABLE_KEYS = {
        "enabled",
        "rds_endpoint",
        "rds_port",
        "rds_database",
        "rds_username",
        "rds_password",
        "rds_ssl_required",
        "source_public_host",
        "source_public_port",
        "replication_user",
        "replication_password",
        "replication_state",
        "replication_last_error",
    }

    def get_config(self, site: WordPressSite, *, redact: bool = False) -> Dict[str, Any]:
        merged = copy.deepcopy(self.DEFAULT_CONFIG)
        stored = site.db_dr_config or {}
        if isinstance(stored, dict):
            merged.update(stored)

        if redact:
            if merged.get("rds_password"):
                merged["rds_password_set"] = True
            else:
                merged["rds_password_set"] = False
            if merged.get("replication_password"):
                merged["replication_password_set"] = True
            else:
                merged["replication_password_set"] = False
            merged["rds_password"] = ""
            merged["replication_password"] = ""

        return merged

    def update_config(self, site: WordPressSite, payload: Dict[str, Any]) -> Dict[str, Any]:
        config = self.get_config(site, redact=False)

        for key, value in payload.items():
            if key not in self.EDITABLE_KEYS:
                continue
            if key in ("rds_password", "replication_password") and value in (None, ""):
                # Preserve existing secret when caller sends blank.
                continue
            config[key] = value

        site.db_dr_config = config
        site.save(update_fields=["db_dr_config", "updated_at"])
        return self.get_config(site, redact=True)

    def validate_failover_ready(self, site: WordPressSite) -> Tuple[bool, Optional[str]]:
        config = self.get_config(site, redact=False)
        if not config.get("enabled"):
            return False, "RDS failover is disabled for this site."

        required_keys = ["rds_endpoint", "rds_database", "rds_username", "rds_password"]
        missing = [key for key in required_keys if not config.get(key)]
        if missing:
            return False, f"Missing RDS config fields: {', '.join(missing)}"
        return True, None

    def test_rds_connection(self, site: WordPressSite, timeout: int = 5) -> Tuple[bool, str]:
        config = self.get_config(site, redact=False)
        ok, err = self.validate_failover_ready(site)
        if not ok:
            return False, err or "Invalid RDS config"

        try:
            import MySQLdb
        except Exception as exc:
            return False, f"mysqlclient/MySQLdb is unavailable: {exc}"

        try:
            conn = MySQLdb.connect(
                host=config["rds_endpoint"],
                port=int(config.get("rds_port", 3306)),
                user=config["rds_username"],
                passwd=config["rds_password"],
                db=config["rds_database"],
                connect_timeout=timeout,
            )
            try:
                with conn.cursor() as cur:
                    cur.execute("SELECT 1")
                    cur.fetchone()
            finally:
                conn.close()
            return True, "RDS connection test succeeded."
        except Exception as exc:
            return False, f"RDS connection failed: {exc}"

    def get_replication_plan(self, site: WordPressSite) -> Dict[str, Any]:
        config = self.get_config(site, redact=False)
        source_host = config.get("source_public_host") or "<SOURCE_PUBLIC_IP_OR_DNS>"
        source_port = int(config.get("source_public_port") or 3306)
        repl_user = config.get("replication_user") or "replicator"
        repl_password = config.get("replication_password") or "<REPLICATION_PASSWORD>"

        source_sql = [
            f"CREATE USER IF NOT EXISTS '{repl_user}'@'%' IDENTIFIED BY '{repl_password}';",
            f"GRANT REPLICATION SLAVE, REPLICATION CLIENT ON *.* TO '{repl_user}'@'%';",
            "FLUSH PRIVILEGES;",
            "SHOW MASTER STATUS;",
        ]

        rds_sql = [
            "-- Run one of these (depends on your RDS engine/version):",
            f"CALL mysql.rds_set_external_master('{source_host}', {source_port}, '{repl_user}', '{repl_password}', '<MASTER_LOG_FILE>', <MASTER_LOG_POS>, 1);",
            f"CALL mysql.rds_set_external_source('{source_host}', {source_port}, '{repl_user}', '{repl_password}', '<MASTER_LOG_FILE>', <MASTER_LOG_POS>, 1);",
            "CALL mysql.rds_start_replication;",
            "-- Verify:",
            "SHOW REPLICA STATUS\\G",
            "SHOW SLAVE STATUS\\G",
        ]

        return {
            "source_sql": source_sql,
            "rds_sql": rds_sql,
            "checklist": [
                "Enable binlog/GTID/server_id on local MySQL source.",
                "Allow inbound source MySQL port only from RDS-side CIDR/security group path.",
                "Enable SSL for replication procedure (last argument = 1).",
                "Confirm replication lag and SQL thread health.",
            ],
        }

    def _promote_rds(self, config: Dict[str, Any]) -> Tuple[bool, str]:
        try:
            import MySQLdb
        except Exception as exc:
            return False, f"mysqlclient/MySQLdb is unavailable: {exc}"

        try:
            conn = MySQLdb.connect(
                host=config["rds_endpoint"],
                port=int(config.get("rds_port", 3306)),
                user=config["rds_username"],
                passwd=config["rds_password"],
                db=config["rds_database"],
                connect_timeout=8,
                autocommit=True,
            )
        except Exception as exc:
            return False, f"RDS connect failed during promotion: {exc}"

        warnings = []
        try:
            with conn.cursor() as cur:
                stop_candidates = [
                    "CALL mysql.rds_stop_replication;",
                    "CALL mysql.rds_stop_replication();",
                    "STOP REPLICA;",
                    "STOP SLAVE;",
                ]
                reset_candidates = [
                    "CALL mysql.rds_reset_external_master;",
                    "CALL mysql.rds_reset_external_source;",
                    "RESET REPLICA ALL;",
                    "RESET SLAVE ALL;",
                ]

                stop_ok = False
                for stmt in stop_candidates:
                    try:
                        cur.execute(stmt)
                        stop_ok = True
                        break
                    except Exception as exc:  # noqa: PERF203 - explicit fallback chain
                        warnings.append(f"{stmt} -> {exc}")

                reset_ok = False
                for stmt in reset_candidates:
                    try:
                        cur.execute(stmt)
                        reset_ok = True
                        break
                    except Exception as exc:  # noqa: PERF203 - explicit fallback chain
                        warnings.append(f"{stmt} -> {exc}")

                if not stop_ok and not reset_ok:
                    return False, "RDS promotion failed. None of the stop/reset commands succeeded."
        finally:
            conn.close()

        if warnings:
            return True, "RDS promoted with warnings. Check procedure compatibility in logs."
        return True, "RDS promoted successfully."

    @staticmethod
    def _mysql_url(host: str, port: int, username: str, password: str, database: str) -> str:
        return f"mysql://{username}:{password}@{host}:{port}/{database}"

    def _rewrite_compose_db_target(
        self,
        site: WordPressSite,
        *,
        host: str,
        port: int,
        database: str,
        username: str,
        password: str,
    ) -> Tuple[bool, str]:
        compose_path = Path(site.site_directory) / "docker-compose.yml"
        if not compose_path.exists():
            return False, f"docker-compose.yml not found at {compose_path}"

        try:
            with compose_path.open("r") as f:
                compose_data = yaml.safe_load(f) or {}
        except Exception as exc:
            return False, f"Failed to parse docker-compose.yml: {exc}"

        services = compose_data.get("services", {})
        if not isinstance(services, dict) or not services:
            return False, "docker-compose.yml has no services section"

        if site.framework == "wordpress":
            wp_key = f"{site.name}_wordpress"
            wp_service = services.get(wp_key)
            if not isinstance(wp_service, dict):
                return False, f"WordPress service '{wp_key}' not found"

            env = wp_service.get("environment", {}) or {}
            env["WORDPRESS_DB_HOST"] = f"{host}:{port}"
            env["WORDPRESS_DB_USER"] = username
            env["WORDPRESS_DB_PASSWORD"] = password
            env["WORDPRESS_DB_NAME"] = database
            wp_service["environment"] = env
            services[wp_key] = wp_service

        elif site.framework == "react_django":
            backend_prefix = f"{site.name}_backend"
            backend_keys = [key for key in services.keys() if key == backend_prefix or key.startswith(f"{backend_prefix}_")]
            if not backend_keys:
                return False, "No backend service definitions found for react_django site"

            db_url = self._mysql_url(
                host=host,
                port=port,
                username=username,
                password=password,
                database=database,
            )
            for key in backend_keys:
                svc = services.get(key) or {}
                env = svc.get("environment", {}) or {}
                env["DATABASE_URL"] = db_url
                svc["environment"] = env
                services[key] = svc
        else:
            return False, f"Unsupported framework for DB failover: {site.framework}"

        compose_data["services"] = services
        try:
            with compose_path.open("w") as f:
                yaml.dump(compose_data, f, default_flow_style=False, sort_keys=False)
        except Exception as exc:
            return False, f"Failed to write docker-compose.yml: {exc}"

        return True, "docker-compose.yml database target updated."

    def _rewrite_wp_config(
        self,
        site: WordPressSite,
        *,
        host: str,
        port: int,
        database: str,
        username: str,
        password: str,
    ) -> Tuple[bool, str]:
        if site.framework != "wordpress":
            return True, "wp-config rewrite skipped (non-WordPress project)."

        wp_config_path = Path(site.site_directory) / "wp-config.php"
        if not wp_config_path.exists():
            return False, f"wp-config.php not found at {wp_config_path}"

        try:
            content = wp_config_path.read_text()
        except Exception as exc:
            return False, f"Failed to read wp-config.php: {exc}"

        replacements = {
            "DB_NAME": database,
            "DB_USER": username,
            "DB_PASSWORD": password,
            "DB_HOST": f"{host}:{port}",
        }

        for key, value in replacements.items():
            pattern = re.compile(rf"define\(\s*'{key}'\s*,\s*'[^']*'\s*\);")
            if pattern.search(content):
                content = pattern.sub(f"define( '{key}', '{value}' );", content, count=1)
            else:
                content += f"\ndefine( '{key}', '{value}' );"

        try:
            wp_config_path.write_text(content)
        except Exception as exc:
            return False, f"Failed to write wp-config.php: {exc}"

        return True, "wp-config.php database target updated."

    def _save_runtime_state(self, site: WordPressSite, updates: Dict[str, Any]) -> Dict[str, Any]:
        config = self.get_config(site, redact=False)
        config.update(updates)
        site.db_dr_config = config
        site.save(update_fields=["db_dr_config", "updated_at"])
        return config

    def failover_to_rds(self, site: WordPressSite, *, promote_rds: bool = True) -> Tuple[bool, str, Optional[str]]:
        ready, err = self.validate_failover_ready(site)
        if not ready:
            return False, err or "Invalid RDS config", None

        config = self.get_config(site, redact=False)
        ok, msg = self.test_rds_connection(site)
        if not ok:
            self._save_runtime_state(site, {"replication_state": "error", "replication_last_error": msg})
            return False, msg, None

        if promote_rds:
            promoted, promote_msg = self._promote_rds(config)
            if not promoted:
                self._save_runtime_state(site, {"replication_state": "error", "replication_last_error": promote_msg})
                return False, promote_msg, None

        compose_ok, compose_msg = self._rewrite_compose_db_target(
            site,
            host=config["rds_endpoint"],
            port=int(config.get("rds_port", 3306)),
            database=config["rds_database"],
            username=config["rds_username"],
            password=config["rds_password"],
        )
        if not compose_ok:
            self._save_runtime_state(site, {"replication_state": "error", "replication_last_error": compose_msg})
            return False, compose_msg, None

        wp_ok, wp_msg = self._rewrite_wp_config(
            site,
            host=config["rds_endpoint"],
            port=int(config.get("rds_port", 3306)),
            database=config["rds_database"],
            username=config["rds_username"],
            password=config["rds_password"],
        )
        if not wp_ok:
            self._save_runtime_state(site, {"replication_state": "error", "replication_last_error": wp_msg})
            return False, wp_msg, None

        docker_ok, docker_output = run_docker_compose_up(site.site_directory)
        if not docker_ok:
            self._save_runtime_state(
                site,
                {
                    "replication_state": "error",
                    "replication_last_error": docker_output,
                },
            )
            site.status = "error"
            site.save(update_fields=["status", "updated_at"])
            return False, f"Failover switch applied but restart failed: {docker_output}", docker_output

        self._save_runtime_state(
            site,
            {
                "active_target": "rds",
                "replication_state": "promoted",
                "replication_last_error": "",
                "last_failover_at": timezone.now().isoformat(),
            },
        )
        site.status = "running"
        site.save(update_fields=["status", "updated_at"])
        return True, "Site failed over to RDS successfully.", docker_output

    def failback_to_local(self, site: WordPressSite) -> Tuple[bool, str, Optional[str]]:
        if not site.db_host or not site.db_name or not site.db_user or not site.db_password:
            return False, "Local database credentials are incomplete on this site record.", None

        compose_ok, compose_msg = self._rewrite_compose_db_target(
            site,
            host=site.db_host,
            port=3306,
            database=site.db_name,
            username=site.db_user,
            password=site.db_password,
        )
        if not compose_ok:
            self._save_runtime_state(site, {"replication_state": "error", "replication_last_error": compose_msg})
            return False, compose_msg, None

        wp_ok, wp_msg = self._rewrite_wp_config(
            site,
            host=site.db_host,
            port=3306,
            database=site.db_name,
            username=site.db_user,
            password=site.db_password,
        )
        if not wp_ok:
            self._save_runtime_state(site, {"replication_state": "error", "replication_last_error": wp_msg})
            return False, wp_msg, None

        docker_ok, docker_output = run_docker_compose_up(site.site_directory)
        if not docker_ok:
            self._save_runtime_state(
                site,
                {
                    "replication_state": "error",
                    "replication_last_error": docker_output,
                },
            )
            site.status = "error"
            site.save(update_fields=["status", "updated_at"])
            return False, f"Failback switch applied but restart failed: {docker_output}", docker_output

        self._save_runtime_state(
            site,
            {
                "active_target": "local",
                "replication_last_error": "",
                "last_failback_at": timezone.now().isoformat(),
            },
        )
        site.status = "running"
        site.save(update_fields=["status", "updated_at"])
        return True, "Site failed back to local database successfully.", docker_output
