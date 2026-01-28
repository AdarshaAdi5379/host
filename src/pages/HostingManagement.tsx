import { PerformanceSnapshot } from '@/components/hosting/PerformanceSnapshot'
import { ResourceGauges } from '@/components/hosting/ResourceGauges'
import { QuickAccessPanel } from '@/components/hosting/QuickAccessPanel'
import { CMSToolkit } from '@/components/hosting/CMSToolkit'
import { SecurityOverview } from '@/components/hosting/SecurityOverview'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'

export function HostingManagement() {
    return (
        <div className="space-y-6">
            <Breadcrumbs items={[{ label: 'Hosting' }]} />

            <div>
                <h1 className="text-3xl font-bold text-brand-navy">Hosting Management</h1>
                <p className="text-gray-600 mt-1">
                    Centralized control panel for your website configuration
                </p>
            </div>

            {/* Performance Snapshot */}
            <PerformanceSnapshot />

            {/* Resource Gauges & Quick Access */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ResourceGauges />
                <QuickAccessPanel />
            </div>

            {/* CMS Toolkit & Security */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <CMSToolkit />
                <SecurityOverview />
            </div>
        </div>
    )
}
