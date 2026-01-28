import { useAuthStore } from '@/store/authStore'
import { mockServices } from '@/data/mockData'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { Server, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useNavigate } from 'react-router-dom'

export function HostingManagement() {
    const { user } = useAuthStore()
    const navigate = useNavigate()

    // Show demo data only for admin
    const isAdmin = user?.role === 'owner'
    const hostingServices = isAdmin ? mockServices.filter(s => s.type === 'hosting') : []

    return (
        <div className="space-y-6">
            <Breadcrumbs items={[{ label: 'Hosting' }]} />

            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-brand-navy">Hosting Services</h1>
                    <p className="text-gray-600 mt-1">Manage your web hosting and server resources</p>
                </div>
                {hostingServices.length > 0 && (
                    <Button variant="primary" onClick={() => navigate('/hosting/create')}>
                        <Plus className="w-4 h-4 mr-2" />
                        New Hosting
                    </Button>
                )}
            </div>

            {hostingServices.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Show hosting cards for admin */}
                    {hostingServices.map(service => (
                        <div key={service.id} className="border border-gray-200 rounded-lg p-6">
                            <h3 className="font-semibold text-brand-navy">{service.name}</h3>
                            <p className="text-sm text-gray-600 mt-2">{service.domain}</p>
                        </div>
                    ))}
                </div>
            ) : (
                /* Empty State */
                <div className="py-16 text-center">
                    <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Server className="w-10 h-10 text-blue-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-brand-navy mb-3">
                        No Hosting Services Yet
                    </h2>
                    <p className="text-gray-600 mb-6 max-w-md mx-auto">
                        You haven't created any hosting services. Get started by deploying your first website.
                    </p>
                    <Button variant="primary" onClick={() => navigate('/hosting/create')}>
                        <Plus className="w-4 h-4 mr-2" />
                        Create Your First Hosting
                    </Button>
                </div>
            )}
        </div>
    )
}
