import { useAuthStore } from '@/store/authStore'
import { hasPermission } from '@/lib/rbac'
import type { Permission } from '@/types/auth'
import type { ReactNode } from 'react'

interface CanProps {
    permission: Permission
    children: ReactNode
    fallback?: ReactNode
}

/**
 * Feature gating component - conditionally renders children based on user permissions
 * Usage: <Can permission="delete_database">...</Can>
 */
export function Can({ permission, children, fallback = null }: CanProps) {
    const { user } = useAuthStore()

    if (!user || !hasPermission(user.role, permission)) {
        return <>{fallback}</>
    }

    return <>{children}</>
}
