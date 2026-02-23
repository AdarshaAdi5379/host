
import { useAuthStore } from '@/store/authStore.ts'
import { SuperAdminDashboard } from '@/components/dashboard/SuperAdminDashboard'
import { SiteOwnerDashboard } from '@/components/dashboard/SiteOwnerDashboard'
import { CollaboratorDashboard } from '@/components/dashboard/CollaboratorDashboard'

export function Dashboard() {
    const { user } = useAuthStore()

    if (!user) return null

    // Super Admin View
    if (user.platform_role === 'super_admin') {
        return (
            <div className="space-y-12">
                <SuperAdminDashboard />
                <SiteOwnerDashboard />
            </div>
        )
    }

    // Standard User View
    // Shows both Owner and Collaborator dashboards
    return (
        <div className="space-y-12">
            <SiteOwnerDashboard />
            <CollaboratorDashboard />
        </div>
    )
}
