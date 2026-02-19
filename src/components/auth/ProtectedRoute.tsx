import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore, useHasHydrated } from '@/store/authStore'
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
    const hydrated = useHasHydrated()
    const location = useLocation()

    // Show a splash while Zustand rehydrates from localStorage.
    // Without this, isAuthenticated starts as false and immediately
    // redirects to /login before the persisted token is loaded.
    if (!hydrated) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-gray-500">Loading...</p>
                </div>
            </div>
        )
    }

    // Not authenticated - redirect to login
    if (!isAuthenticated || !user) {
        return <Navigate to="/login" state={{ from: location }} replace />
    }

    // Check permission if required
    if (requiredPermission && !hasPermission(user.role, requiredPermission)) {
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
