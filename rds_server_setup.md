# Complete AWS RDS Server Setup Guide

When deploying the `HOST` platform to a new server from GitHub, the server will start completely empty (no databases, no sites). It will **not** pull down `db.sqlite3` from your local machine. 

This guide explains how to connect individual sites created on your new server to your existing AWS RDS databases.

---

## Part 1: Initial Server Setup

First, initialize the empty platform database and create an admin user on the new server:

```bash
# 1. Create a fresh .env file for the backend
cp backend/.env.example backend/.env
nano backend/.env  # Fill in your DJANGO_SECRET_KEY, S3 keys, etc.

# 2. Initialize the fresh SQLite control-plane database
cd backend
python manage.py migrate

# 3. Create your admin account to log into the dashboard
python manage.py createsuperuser
```

---

## Part 2: Connect a New Site to AWS RDS

Since your RDS architecture operates on a **per-site** basis (via `rds_failover_manager.py`), you must map each site created on the dashboard to its corresponding database in AWS RDS.

### Step 1: Create the Site
Log into the platform dashboard and create the site (e.g., `mysite`). It will initially provision using the local dummy containers.

### Step 2: Inject the RDS Credentials
Open the Django shell on the server:

```bash
cd backend
python manage.py shell
```

Run this Python script to attach your AWS RDS credentials to the site payload:

```python
from sites.models import WordPressSite

# 1. Get the site you just created
site = WordPressSite.objects.get(name="mysite")

# 2. Set your AWS RDS credentials
site.db_dr_config = {
    "enabled": True,
    "active_target": "rds",
    
    # Your AWS RDS Master Endpoint
    "rds_endpoint": "mysql-database.cz2m4kq4gd4a.ap-south-1.rds.amazonaws.com",
    "rds_port": 3306,
    
    # The specific database name for this site (e.g. wp_mysite, wp_tes1)
    "rds_database": "wp_mysite",  
    
    # Master Username
    "rds_username": "mysqlad",
    
    # Master Password
    "rds_password": "<your_secret_password>",
    "rds_ssl_required": True,
}
site.save()
print("RDS credentials saved successfully!")
exit()
```

### Step 3: Execute the Failover
Run the orchestrator command to rewrite the site's docker environment variables to point to the AWS RDS database instead of the local one:

```bash
python manage.py shell -c "
from sites.rds_failover_manager import RDSFailoverManager
from sites.models import WordPressSite

site = WordPressSite.objects.get(name='mysite')
manager = RDSFailoverManager()

# This rewrites docker-compose.yml and restarts the container using RDS
success, msg, output = manager.failover_to_rds(site, promote_rds=False)
print('Result:', msg)
"
```

## Troubleshooting

- **Connection Refused / Timeout**: Ensure the AWS RDS Security Group allows inbound TCP port `3306` from your new server's IP address.
- **Failover Errors**: Check `backend/wordpress_sites/<sitename>/docker-compose.yml` to verify the environment variables `WORDPRESS_DB_HOST` or `DATABASE_URL` successfully rewrote to point to `cz2m4kq4gd4a.ap-south-1.rds.amazonaws.com`.
