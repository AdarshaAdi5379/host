"""
Helpers for API gateway route normalization and nginx config rendering.
"""
from __future__ import annotations

import re
from dataclasses import dataclass


_API_ROUTE_PATTERN = re.compile(r"^/api/([a-zA-Z0-9][a-zA-Z0-9_-]*)/?$")


@dataclass(frozen=True)
class RenderedRoute:
    path: str
    target_url: str
    strip_prefix: bool


def normalize_api_route_path(raw_path: str) -> str:
    """
    Normalize user input into canonical /api/<segment>/ form.

    Accepted inputs:
      - "payments"
      - "/api/payments"
      - "/api/payments/"
    """
    if raw_path is None:
        raise ValueError("Route path is required")

    path = str(raw_path).strip()
    if not path:
        raise ValueError("Route path is required")

    if not path.startswith("/"):
        path = f"/api/{path.lstrip('/')}"

    match = _API_ROUTE_PATTERN.match(path)
    if not match:
        raise ValueError("Path must be in /api/<something> format")

    segment = match.group(1).lower()
    return f"/api/{segment}/"


def _proxy_header_block() -> str:
    return """        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Connection \"\";"""


def render_frontend_gateway_nginx(
    site_name: str,
    backend_services: list[str],
    custom_routes: list[RenderedRoute],
) -> str:
    """
    Build nginx config for the per-project frontend container.

    - /api/<something>/ custom routes are generated first (longest path first).
    - /api/ fallback goes to the project's default backend pool.
    - / routes continue to serve SPA/static content.
    """
    if not site_name:
        raise ValueError("site_name is required")

    upstream_name = f"{site_name}_api"
    if len(backend_services) <= 1:
        upstream_block = ""
        default_api_target = f"http://{backend_services[0]}:8000" if backend_services else None
    else:
        backend_lines = "\n".join(f"    server {svc}:8000;" for svc in backend_services)
        upstream_block = f"""upstream {upstream_name} {{
    least_conn;
{backend_lines}
}}"""
        default_api_target = f"http://{upstream_name}"

    location_blocks: list[str] = []

    # More specific paths should win before less specific paths.
    ordered_routes = sorted(custom_routes, key=lambda r: (-len(r.path), r.path))
    for route in ordered_routes:
        base = route.path.rstrip("/")
        escaped_path = re.escape(route.path.rstrip("/"))

        if route.strip_prefix:
            rewrite_line = f"        rewrite ^{escaped_path}/?(.*)$ /$1 break;"
        else:
            rewrite_line = ""

        location_blocks.append(
            f"""    location = {base} {{
        return 308 {route.path};
    }}

    location ^~ {route.path} {{
{rewrite_line}
        proxy_pass {route.target_url};
{_proxy_header_block()}
    }}"""
        )

    if default_api_target:
        location_blocks.append(
            f"""    location /api/ {{
        proxy_pass {default_api_target};
{_proxy_header_block()}
        add_header X-Upstream $upstream_addr always;
        add_header X-Upstream-Status $upstream_status always;
    }}"""
        )
    else:
        location_blocks.append(
            """    location /api/ {
        default_type application/json;
        return 404 '{"error":"No default API backend configured"}';
    }"""
        )

    all_locations = "\n\n".join(location_blocks)

    return f"""# Frontend Nginx — {site_name}
{upstream_block}

server {{
    listen 80;
    listen [::]:80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

{all_locations}

    location / {{
        try_files $uri /index.html;
    }}
}}
"""
