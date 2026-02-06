import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { Globe, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useNavigate } from 'react-router-dom'

export function DomainManagement() {
    const navigate = useNavigate()

    // Only show real data from database
    const domainServices: any[] = []

    return (
        <div className="space-y-6">
            <Breadcrumbs items={[{ label: 'Domains' }]} />

            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-brand-navy">Domain Management</h1>
                    <p className="text-gray-600 mt-1">Manage your domain names and DNS settings</p>
                </div>
                {domainServices.length > 0 && (
                    <Button variant="primary" onClick={() => navigate('/domains/search')}>
                        <Search className="w-4 h-4 mr-2" />
                        Search Domains
                    </Button>
                )}
            </div>

            {domainServices.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Show domain cards for admin */}
                    {domainServices.map(service => (
                        <div key={service.id} className="border border-gray-200 rounded-lg p-6">
                            <h3 className="font-semibold text-brand-navy">{service.name}</h3>
                            <p className="text-sm text-gray-600 mt-2">{service.domain}</p>
                        </div>
                    ))}
                </div>
            ) : (
                /* Empty State */
                <div className="py-16 text-center">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Globe className="w-10 h-10 text-green-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-brand-navy mb-3">
                        No Domains Registered
                    </h2>
                    <p className="text-gray-600 mb-6 max-w-md mx-auto">
                        You don't have any domains yet. Search and register your perfect domain name to get started.
                    </p>
                    <div className="flex items-center justify-center space-x-3">
                        <Button variant="primary" onClick={() => navigate('/domains/search')}>
                            <Search className="w-4 h-4 mr-2" />
                            Search Domains
                        </Button>
                        <Button variant="outline" onClick={() => navigate('/domains/transfer')}>
                            Transfer Domain
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
