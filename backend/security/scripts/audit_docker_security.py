#!/usr/bin/env python3
"""
Docker Security Audit Script
Scans docker-compose.yml files for security issues
"""

import os
import sys
import yaml
from pathlib import Path
from typing import List, Dict, Tuple

# ANSI colors
RED = '\033[0;31m'
GREEN = '\033[0;32m'
YELLOW = '\033[1;33m'
BLUE = '\033[0;34m'
NC = '\033[0m'  # No Color

class DockerSecurityAuditor:
    def __init__(self):
        self.issues = []
        self.warnings = []
        self.passed = []
        
    def audit_file(self, filepath: Path) -> None:
        """Audit a single docker-compose.yml file"""
        print(f"\n{BLUE}Auditing: {filepath}{NC}")
        
        try:
            with open(filepath, 'r') as f:
                config = yaml.safe_load(f)
        except Exception as e:
            self.issues.append(f"Failed to parse {filepath}: {e}")
            return
            
        if not config or 'services' not in config:
            self.warnings.append(f"{filepath}: No services defined")
            return
            
        for service_name, service_config in config['services'].items():
            self._audit_service(filepath, service_name, service_config)
            
    def _audit_service(self, filepath: Path, service_name: str, config: Dict) -> None:
        """Audit a single service configuration"""
        
        # Check 1: Port bindings
        if 'ports' in config:
            for port in config['ports']:
                port_str = str(port)
                
                # Check if binding to 0.0.0.0 (public)
                if ':' in port_str:
                    parts = port_str.split(':')
                    if len(parts) >= 2:
                        host = parts[0] if len(parts) == 3 else parts[0].split('/')[0]
                        
                        if host != '127.0.0.1' and host != 'localhost':
                            self.issues.append(
                                f"{filepath} → {service_name}: "
                                f"Port {port_str} binds to public interface. "
                                f"Change to '127.0.0.1:{port_str.split(':')[-1]}'"
                            )
                        else:
                            self.passed.append(
                                f"{service_name}: Port {port_str} correctly bound to localhost"
                            )
                else:
                    # Short form like "8000:8000" defaults to 0.0.0.0
                    self.issues.append(
                        f"{filepath} → {service_name}: "
                        f"Port {port_str} uses short form (binds to 0.0.0.0). "
                        f"Change to '127.0.0.1:{port_str}'"
                    )
                    
        # Check 2: Privileged mode
        if config.get('privileged', False):
            self.issues.append(
                f"{filepath} → {service_name}: "
                f"Running in privileged mode (security risk)"
            )
            
        # Check 3: Docker socket mounting
        if 'volumes' in config:
            for volume in config['volumes']:
                volume_str = str(volume)
                if '/var/run/docker.sock' in volume_str:
                    if ':ro' not in volume_str:
                        self.issues.append(
                            f"{filepath} → {service_name}: "
                            f"Docker socket mounted with write access. "
                            f"Add ':ro' for read-only"
                        )
                    else:
                        self.warnings.append(
                            f"{service_name}: Docker socket mounted (even read-only is risky)"
                        )
                        
        # Check 4: Network mode
        if config.get('network_mode') == 'host':
            self.issues.append(
                f"{filepath} → {service_name}: "
                f"Using host network mode (bypasses network isolation)"
            )
            
        # Check 5: Cap add
        if 'cap_add' in config:
            self.warnings.append(
                f"{service_name}: Additional capabilities granted: {config['cap_add']}"
            )
            
        # Check 6: Security opt
        if 'security_opt' in config:
            for opt in config['security_opt']:
                if 'apparmor=unconfined' in opt or 'seccomp=unconfined' in opt:
                    self.issues.append(
                        f"{filepath} → {service_name}: "
                        f"Security restrictions disabled: {opt}"
                    )
                    
    def print_report(self) -> int:
        """Print audit report and return exit code"""
        print(f"\n{'='*70}")
        print(f"{BLUE}Docker Security Audit Report{NC}")
        print(f"{'='*70}\n")
        
        # Critical issues
        if self.issues:
            print(f"{RED}❌ CRITICAL ISSUES ({len(self.issues)}):{NC}")
            for issue in self.issues:
                print(f"  {RED}•{NC} {issue}")
            print()
            
        # Warnings
        if self.warnings:
            print(f"{YELLOW}⚠️  WARNINGS ({len(self.warnings)}):{NC}")
            for warning in self.warnings:
                print(f"  {YELLOW}•{NC} {warning}")
            print()
            
        # Passed checks
        if self.passed:
            print(f"{GREEN}✓ PASSED CHECKS ({len(self.passed)}):{NC}")
            for passed in self.passed[:5]:  # Show first 5
                print(f"  {GREEN}•{NC} {passed}")
            if len(self.passed) > 5:
                print(f"  {GREEN}... and {len(self.passed) - 5} more{NC}")
            print()
            
        # Summary
        print(f"{'='*70}")
        print(f"Summary: {RED}{len(self.issues)} issues{NC}, "
              f"{YELLOW}{len(self.warnings)} warnings{NC}, "
              f"{GREEN}{len(self.passed)} passed{NC}")
        print(f"{'='*70}\n")
        
        return 1 if self.issues else 0

def main():
    print(f"{GREEN}=== Docker Security Auditor ==={NC}")
    
    # Find all docker-compose.yml files
    project_root = Path(__file__).parent.parent.parent
    compose_files = list(project_root.rglob('docker-compose.yml'))
    compose_files.extend(list(project_root.rglob('docker-compose.*.yml')))
    
    if not compose_files:
        print(f"{YELLOW}No docker-compose.yml files found{NC}")
        return 0
        
    print(f"Found {len(compose_files)} docker-compose file(s)\n")
    
    auditor = DockerSecurityAuditor()
    
    for filepath in compose_files:
        # Skip security templates
        if 'security/configs' in str(filepath):
            continue
            
        auditor.audit_file(filepath)
        
    return auditor.print_report()

if __name__ == '__main__':
    sys.exit(main())
