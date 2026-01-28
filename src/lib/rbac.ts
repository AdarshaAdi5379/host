import type { Role, Permission } from '@/types/auth'

// Role-based permissions mapping
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
    owner: [
        'manage_billing',
        'delete_service',
        'manage_websites',
        'manage_files',
        'manage_databases',
        'view_analytics',
        'view_logs',
        'manage_team',
        'manage_dns',
        'manage_email',
    ],
    editor: [
        'manage_websites',
        'manage_files',
        'manage_databases',
        'view_analytics',
        'manage_dns',
        'manage_email',
    ],
    viewer: ['view_analytics', 'view_logs'],
    user: [
        'manage_websites',
        'manage_files',
        'manage_databases',
        'view_analytics',
        'view_logs',
        'manage_dns',
        'manage_email',
    ],
}

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: Role, permission: Permission): boolean {
    return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}

/**
 * Check if a role has any of the specified permissions
 */
export function hasAnyPermission(role: Role, permissions: Permission[]): boolean {
    return permissions.some((permission) => hasPermission(role, permission))
}

/**
 * Check if a role has all of the specified permissions
 */
export function hasAllPermissions(role: Role, permissions: Permission[]): boolean {
    return permissions.every((permission) => hasPermission(role, permission))
}

/**
 * Check if user can access billing
 */
export function canAccessBilling(role: Role): boolean {
    return hasPermission(role, 'manage_billing')
}

/**
 * Check if user can delete services
 */
export function canDeleteService(role: Role): boolean {
    return hasPermission(role, 'delete_service')
}

/**
 * Check if user can manage files
 */
export function canManageFiles(role: Role): boolean {
    return hasPermission(role, 'manage_files')
}

/**
 * Check if user can manage team
 */
export function canManageTeam(role: Role): boolean {
    return hasPermission(role, 'manage_team')
}

/**
 * Get role display name
 */
export function getRoleDisplayName(role: Role): string {
    const names: Record<Role, string> = {
        owner: 'Owner',
        editor: 'Editor',
        viewer: 'Viewer',
        user: 'User',
    }
    return names[role]
}

/**
 * Get role description
 */
export function getRoleDescription(role: Role): string {
    const descriptions: Record<Role, string> = {
        owner: 'Full access to billing, servers, and team management',
        editor: 'Can manage websites and files but cannot see billing or delete services',
        viewer: 'Read-only access to monitoring and logs',
        user: 'Standard access to manage own services and domains',
    }
    return descriptions[role]
}
