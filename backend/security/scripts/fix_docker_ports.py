#!/usr/bin/env python3
"""
Docker Security Fix Script
Automatically fixes insecure port bindings in docker-compose.yml files
Changes 0.0.0.0:PORT or just PORT to 127.0.0.1:PORT
"""

import os
import sys
import yaml
import shutil
from pathlib import Path
from typing import List, Dict, Tuple

# ANSI colors
RED = '\033[0;31m'
GREEN = '\033[0;32m'
YELLOW = '\033[1;33m'
BLUE = '\033[0;34m'
NC = '\033[0m'  # No Color

class DockerSecurityFixer:
    def __init__(self):
        self.fixed_files = []
        self.errors = []
        
    def fix_file(self, filepath: Path) -> bool:
        """Fix a single docker-compose.yml file"""
        print(f"\n{BLUE}Checking: {filepath}{NC}")
        
        try:
            with open(filepath, 'r') as f:
                content = f.read()
                config = yaml.safe_load(content)
        except Exception as e:
            self.errors.append(f"Failed to parse {filepath}: {e}")
            return False
            
        if not config or 'services' not in config:
            return False
            
        modified = False
        
        for service_name, service_config in config['services'].items():
            if 'ports' in service_config:
                new_ports = []
                service_modified = False
                
                for port in service_config['ports']:
                    port_str = str(port)
                    
                    # Check if binding to 0.0.0.0 (public) or missing IP
                    needs_fix = False
                    
                    if ':' in port_str:
                        parts = port_str.split(':')
                        # Case: 8000:8000 (Implicit 0.0.0.0)
                        if len(parts) == 2:
                            needs_fix = True
                            fixed_port = f"127.0.0.1:{port_str}"
                        # Case: 0.0.0.0:8000:8000 (Explicit 0.0.0.0)
                        elif len(parts) == 3 and parts[0] == '0.0.0.0':
                            needs_fix = True
                            fixed_port = f"127.0.0.1:{parts[1]}:{parts[2]}"
                        else:
                            fixed_port = port_str
                    else:
                        # Case: 80 (Implicit 0.0.0.0 ephemeral)
                        needs_fix = True
                        fixed_port = f"127.0.0.1:{port_str}"
                        
                    if needs_fix:
                        print(f"  {YELLOW}Fixing {service_name}: {port_str} -> {fixed_port}{NC}")
                        new_ports.append(fixed_port)
                        service_modified = True
                        modified = True
                    else:
                        new_ports.append(port_str)
                
                if service_modified:
                    service_config['ports'] = new_ports
                    
        if modified:
            return self._save_file(filepath, config)
        else:
            print(f"  {GREEN}No issues found{NC}")
            return False

    def _save_file(self, filepath: Path, config: Dict) -> bool:
        """Save the modified configuration with backup"""
        try:
            # Create backup
            backup_path = filepath.with_suffix('.yml.backup')
            shutil.copy2(filepath, backup_path)
            print(f"  {GREEN}Backup created: {backup_path.name}{NC}")
            
            # Save new config
            with open(filepath, 'w') as f:
                yaml.dump(config, f, default_flow_style=False, sort_keys=False)
            
            print(f"  {GREEN}✓ File updated successfully{NC}")
            self.fixed_files.append(str(filepath))
            return True
            
        except Exception as e:
            self.errors.append(f"Failed to save {filepath}: {e}")
            return False

def main():
    print(f"{GREEN}=== Docker Security Fixer ==={NC}")
    print(f"{YELLOW}Scanning for insecure port bindings...{NC}\n")
    
    # Find all docker-compose.yml files
    project_root = Path(__file__).parent.parent.parent
    compose_files = list(project_root.rglob('docker-compose.yml'))
    
    if not compose_files:
        print(f"{YELLOW}No docker-compose.yml files found{NC}")
        return 0
        
    fixer = DockerSecurityFixer()
    
    for filepath in compose_files:
        # Skip security templates
        if 'security/configs' in str(filepath):
            continue
            
        fixer.fix_file(filepath)
        
    print(f"\n{'='*50}")
    print(f"{GREEN}Summary:{NC}")
    print(f"  Fixed files: {len(fixer.fixed_files)}")
    print(f"  Errors: {len(fixer.errors)}")
    print(f"{'='*50}")
    
    if fixer.fixed_files:
        print(f"\n{YELLOW}Note: You must restart containers for changes to take effect.{NC}")
        print(f"Run: docker-compose up -d --force-recreate")

if __name__ == '__main__':
    main()
