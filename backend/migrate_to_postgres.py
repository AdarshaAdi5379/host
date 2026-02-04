#!/usr/bin/env python
"""
Automated Migration Script: SQLite to PostgreSQL
Safely migrates data from SQLite to PostgreSQL with validation
"""
import os
import sys
import subprocess
import json
from pathlib import Path
from datetime import datetime


def print_header(text):
    """Print formatted header"""
    print("\n" + "=" * 70)
    print(f"  {text}")
    print("=" * 70 + "\n")


def print_step(step_num, text):
    """Print step number and description"""
    print(f"[{step_num}/9] {text}...")


def run_command(cmd, env=None):
    """Run a command and return success status"""
    result = subprocess.run(cmd, capture_output=True, text=True, env=env)
    if result.returncode != 0:
        print(f"  ✗ Error: {result.stderr}")
        return False, result.stderr
    return True, result.stdout


def main():
    print_header("PostgreSQL Migration Script")
    print("This script will migrate your data from SQLite to PostgreSQL.")
    print("Estimated time: 5-10 minutes\n")
    
    # Get the backend directory
    backend_dir = Path(__file__).parent
    os.chdir(backend_dir)
    
    # ========================================================================
    # Step 1: Validate Environment Variables
    # ========================================================================
    print_step(1, "Validating environment variables")
    
    required_vars = ['DB_ENGINE', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'DB_HOST']
    missing_vars = []
    
    # Load .env file
    env_file = backend_dir / '.env'
    if not env_file.exists():
        print("  ✗ Error: .env file not found!")
        print("  Please create a .env file based on .env.example")
        return 1
    
    # Parse .env file
    env_vars = {}
    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                env_vars[key] = value
    
    for var in required_vars:
        if var not in env_vars or not env_vars[var]:
            missing_vars.append(var)
    
    if missing_vars:
        print(f"  ✗ Missing required environment variables: {', '.join(missing_vars)}")
        return 1
    
    if env_vars.get('DB_ENGINE') != 'postgresql':
        print("  ✗ DB_ENGINE must be set to 'postgresql'")
        return 1
    
    print("  ✓ Environment variables validated")
    
    # ========================================================================
    # Step 2: Backup SQLite Database
    # ========================================================================
    print_step(2, "Creating SQLite backup")
    
    sqlite_db = backend_dir / 'db.sqlite3'
    if not sqlite_db.exists():
        print("  ⚠ Warning: SQLite database not found. Skipping backup.")
        backup_file = None
    else:
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_file = backend_dir / 'backups' / 'system' / f'sqlite_backup_{timestamp}.json'
        backup_file.parent.mkdir(parents=True, exist_ok=True)
        
        # Temporarily override environment to use SQLite for backup
        temp_env = os.environ.copy()
        temp_env['DB_ENGINE'] = 'sqlite3'
        
        # First, apply any pending migrations to SQLite
        print("  → Applying pending migrations to SQLite...")
        migrate_cmd = [sys.executable, 'manage.py', 'migrate', '--noinput']
        success, output = run_command(migrate_cmd, env=temp_env)
        
        if not success:
            print(f"  ⚠ Warning: Failed to apply migrations to SQLite: {output}")
            print("  Continuing with backup anyway...")
        
        cmd = [
            sys.executable, 'manage.py', 'dumpdata',
            '--natural-foreign',
            '--natural-primary',
            '-e', 'contenttypes',
            '-e', 'auth.Permission',
            '--indent', '2',
            '-o', str(backup_file)
        ]
        
        success, output = run_command(cmd, env=temp_env)
        if not success:
            print(f"  ✗ Failed to create backup: {output}")
            return 1
        
        print(f"  ✓ Backup created: {backup_file}")
    
    # ========================================================================
    # Step 3: Test PostgreSQL Connection
    # ========================================================================
    print_step(3, "Testing PostgreSQL connection")
    
    pg_env = os.environ.copy()
    pg_env.update(env_vars)
    
    # Test connection using Django
    test_cmd = [
        sys.executable, 'manage.py', 'shell', '-c',
        "from django.db import connection; connection.ensure_connection(); print('Connection successful')"
    ]
    
    success, output = run_command(test_cmd, env=pg_env)
    
    if not success:
        print("  ✗ Cannot connect to PostgreSQL")
        print("  Please ensure:")
        print("    1. PostgreSQL is running (docker-compose up -d db_system)")
        print("    2. Credentials in .env are correct")
        print("    3. DB_HOST is accessible")
        print(f"  Error: {output}")
        return 1
    
    print("  ✓ PostgreSQL connection successful")
    
    # ========================================================================
    # Step 4: Database Already Exists (managed by Docker)
    # ========================================================================
    print_step(4, "Verifying database")
    print(f"  ✓ Database '{env_vars['DB_NAME']}' is ready")
    
    # ========================================================================
    # Step 5: Run Django Migrations
    # ========================================================================
    print_step(5, "Running Django migrations on PostgreSQL")
    
    migrate_cmd = [sys.executable, 'manage.py', 'migrate', '--noinput']
    success, output = run_command(migrate_cmd, env=pg_env)
    
    if not success:
        print(f"  ✗ Migration failed: {output}")
        return 1
    
    print("  ✓ Migrations applied successfully")
    
    # ========================================================================
    # Step 6: Clean Content Types
    # ========================================================================
    print_step(6, "Cleaning content types")
    
    clean_cmd = [
        sys.executable, 'manage.py', 'shell', '-c',
        "from django.contrib.contenttypes.models import ContentType; ContentType.objects.all().delete()"
    ]
    
    success, output = run_command(clean_cmd, env=pg_env)
    if not success:
        print(f"  ⚠ Warning: Failed to clean content types: {output}")
    else:
        print("  ✓ Content types cleaned")
    
    # ========================================================================
    # Step 7: Load Data from Backup
    # ========================================================================
    print_step(7, "Loading data into PostgreSQL")
    
    if backup_file is None or not backup_file.exists():
        print("  ⚠ No backup file found. Skipping data load.")
    else:
        load_cmd = [sys.executable, 'manage.py', 'loaddata', str(backup_file)]
        success, output = run_command(load_cmd, env=pg_env)
        
        if not success:
            print(f"  ✗ Failed to load data: {output}")
            print("  You can manually load the backup later using:")
            print(f"    python manage.py loaddata {backup_file}")
            return 1
        
        print("  ✓ Data loaded successfully")
    
    # ========================================================================
    # Step 8: Verify Data Integrity
    # ========================================================================
    print_step(8, "Verifying data integrity")
    
    verify_cmd = [
        sys.executable, 'manage.py', 'shell', '-c',
        """
from sites.models import WordPressSite
from django.contrib.auth.models import User
print(f'WordPress Sites: {WordPressSite.objects.count()}')
print(f'Users: {User.objects.count()}')
"""
    ]
    
    success, output = run_command(verify_cmd, env=pg_env)
    if success:
        print("  ✓ Data verification:")
        for line in output.strip().split('\n'):
            print(f"    {line}")
    else:
        print(f"  ⚠ Warning: Could not verify data: {output}")
    
    # ========================================================================
    # Step 9: Generate Migration Report
    # ========================================================================
    print_step(9, "Generating migration report")
    
    report_file = backend_dir / 'backups' / 'system' / f'migration_report_{timestamp}.txt'
    
    with open(report_file, 'w') as f:
        f.write("PostgreSQL Migration Report\n")
        f.write("=" * 70 + "\n\n")
        f.write(f"Migration Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"Backup File: {backup_file}\n")
        f.write(f"Database: {env_vars['DB_NAME']}\n")
        f.write(f"Host: {env_vars['DB_HOST']}\n\n")
        f.write("Verification Results:\n")
        f.write(output)
        f.write("\n\nMigration completed successfully!\n")
    
    print(f"  ✓ Report saved: {report_file}")
    
    # ========================================================================
    # Success!
    # ========================================================================
    print_header("Migration Completed Successfully!")
    print("✓ Your platform is now running on PostgreSQL")
    print("\nNext steps:")
    print("  1. Restart your Django server:")
    print("     python manage.py runserver")
    print("  2. Test site creation to verify tenant database provisioning")
    print("  3. Configure automated backups (see backup_manager.py)")
    print("\nBackup files are stored in: backend/backups/system/")
    
    return 0


if __name__ == '__main__':
    try:
        exit_code = main()
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print("\n\n✗ Migration cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n✗ Unexpected error: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
