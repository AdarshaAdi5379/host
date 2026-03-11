# Django API + Workers systemd Deployment

This folder contains `systemd` templates used to run Django API, gateway worker, and compute worker as persistent services.

## Files

- `host-django-api.service.template`: Django API unit template
- `host-gateway-worker.service.template`: unit template with placeholders
- `host-compute-worker.service.template`: compute operation worker template

## Install

Run from the backend directory:

```bash
cd /home/adarsha/Desktop/projects/HOST/host/backend
sudo ./scripts/install_django_api_service.sh
sudo ./scripts/install_gateway_worker_service.sh
sudo ./scripts/install_compute_worker_service.sh
```

If you do not have passwordless `sudo`, the compute worker installer can also install
as a user-level systemd service:

```bash
cd /home/adarsha/Desktop/projects/HOST/host/backend
SYSTEMD_SCOPE=user ./scripts/install_compute_worker_service.sh
systemctl --user status host-compute-worker.service --no-pager
```

Install both with one command:

```bash
sudo ./scripts/install_platform_services.sh
```

## Customize

You can override defaults via environment variables:

```bash
sudo SERVICE_NAME=host-gateway-worker \
     RUN_AS_USER=adarsha \
     PYTHON_BIN=/usr/bin/python3 \
     ./scripts/install_gateway_worker_service.sh

sudo SERVICE_NAME=host-compute-worker \
     RUN_AS_USER=adarsha \
     PYTHON_BIN=/usr/bin/python3 \
     ./scripts/install_compute_worker_service.sh

sudo SERVICE_NAME=host-django-api \
     RUN_AS_USER=adarsha \
     PYTHON_BIN=/usr/bin/python3 \
     ./scripts/install_django_api_service.sh
```

## Operations

```bash
sudo systemctl status host-django-api.service --no-pager
sudo systemctl status host-gateway-worker.service --no-pager
sudo systemctl status host-compute-worker.service --no-pager
sudo systemctl restart host-django-api.service
sudo systemctl restart host-gateway-worker.service
sudo systemctl restart host-compute-worker.service
sudo journalctl -u host-django-api.service -f
sudo journalctl -u host-gateway-worker.service -f
sudo journalctl -u host-compute-worker.service -f
```
