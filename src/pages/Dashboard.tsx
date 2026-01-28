import { HostingCard } from '@/components/dashboard/HostingCard'
import { DomainCard } from '@/components/dashboard/DomainCard'
import { EmailCard } from '@/components/dashboard/EmailCard'
import { ResourceUsageCard } from '@/components/dashboard/ResourceUsageCard'
import { QuickActions } from '@/components/dashboard/QuickActions'
import { mockServices, mockResourceUsage } from '@/data/mockData'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'

export function Dashboard() {
    const hostingServices = mockServices.filter(s => s.type === 'hosting')
    const domainServices = mockServices.filter(s => s.type === 'domain')
    const emailServices = mockServices.filter(s => s.type === 'email')

    return (
        <div className="space-y-6">
            {/* Breadcrumbs */}
            <Breadcrumbs items={[{ label: 'Home' }]} />

            {/* Welcome Section */}
            <div>
                <h1 className="text-3xl font-bold text-brand-navy">Welcome back, John!</h1>
                <p className="text-gray-600 mt-1">Here's what's happening with your services today.</p>
            </div>

            {/* Resource Usage */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <ResourceUsageCard usage={mockResourceUsage} />
                </div>
                <div>
                    <QuickActions />
                </div>
            </div>

            {/* Hosting Services */}
            {hostingServices.length > 0 && (
                <div>
                    <h2 className="text-xl font-bold mb-4">Hosting Services</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {hostingServices.map(service => (
                            <HostingCard key={service.id} service={service} />
                        ))}
                    </div>
                </div>
            )}

            {/* Domain Services */}
            {domainServices.length > 0 && (
                <div>
                    <h2 className="text-xl font-bold mb-4">Domains</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {domainServices.map(service => (
                            <DomainCard key={service.id} service={service} />
                        ))}
                    </div>
                </div>
            )}

            {/* Email Services */}
            {emailServices.length > 0 && (
                <div>
                    <h2 className="text-xl font-bold mb-4">Email Services</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {emailServices.map(service => (
                            <EmailCard key={service.id} service={service} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
