import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { hasPermission } from '@/lib/rbac'
import type { Permission } from '@/types/auth'
import type { ReactNode } from 'react'

interface ProtectedRouteProps {
    children: ReactNode
    requiredPermission?: Permission
    fallback?: ReactNode
}

export function ProtectedRoute({
    children,
    requiredPermission,
    fallback,
}: ProtectedRouteProps) {
    const { isAuthenticated, user } = useAuthStore()
    const location = useLocation()

    // Not authenticated - redirect to login
    if (!isAuthenticated || !user) {
        return <Navigate to="/login" state={{ from: location }} replace />
    }

    // Check permission if required
    if (requiredPermission && !hasPermission(user.role, requiredPermission)) {
        // Show fallback or 403 page
        if (fallback) {
            return <>{fallback}</>
        }
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-4xl font-bold text-gray-900 mb-2">403</h1>
                    <p className="text-gray-600">You don't have permission to access this page</p>
                </div>
            </div>
        )
    }

    return <>{children}</>
}
