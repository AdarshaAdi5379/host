import { HostingCard } from '@/components/dashboard/HostingCard'
import { DomainCard } from '@/components/dashboard/DomainCard'
import { EmailCard } from '@/components/dashboard/EmailCard'
import { ResourceUsageCard } from '@/components/dashboard/ResourceUsageCard'
import { QuickActions } from '@/components/dashboard/QuickActions'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { useAuthStore } from '@/store/authStore'
import { Server, Globe, Mail, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { wordpressAPI } from '@/lib/wordpressAPI'

export function Dashboard() {
    const { user } = useAuthStore()
    const navigate = useNavigate()
    const [resourceUsage, setResourceUsage] = useState({ cpu: 0, ram: 0, disk: 0, bandwidth: 0 })

    // Fetch real resource usage data
    useEffect(() => {
        const fetchResourceUsage = async () => {
            try {
                const stats = await wordpressAPI.getAggregateStats()
                // Convert RAM from MB to percentage (assuming 16GB total system RAM)
                const totalSystemRamMB = 16 * 1024 // 16GB in MB
                const ramPercent = (stats.ram / totalSystemRamMB) * 100

                setResourceUsage({
                    cpu: Math.round(stats.cpu),
                    ram: Math.round(ramPercent),
                    disk: 0, // Not tracked yet
                    bandwidth: 0 // Not tracked yet
                })
            } catch (error) {
                console.error('Failed to fetch resource usage:', error)
                // Keep previous values on error
            }
        }

        // Initial fetch
        fetchResourceUsage()

        // Poll every 3 seconds
        const interval = setInterval(fetchResourceUsage, 3000)

        return () => clearInterval(interval)
    }, [])

    // Only show real data from database
    const isAdmin = user?.role === 'owner'
    const hostingServices: any[] = []
    const domainServices: any[] = []
    const emailServices: any[] = []

    const hasAnyServices = hostingServices.length > 0 || domainServices.length > 0 || emailServices.length > 0

    return (
        <div className="space-y-6">
            {/* Breadcrumbs */}
            <Breadcrumbs items={[{ label: 'Home' }]} />

            {/* Welcome Section */}
            <div>
                <h1 className="text-3xl font-bold text-brand-navy">Welcome back, {user?.name || 'User'}!</h1>
                <p className="text-gray-600 mt-1">
                    {hasAnyServices
                        ? "Here's what's happening with your services today."
                        : "Get started by setting up your first service."}
                </p>
            </div>

            {/* Show content based on whether user has services */}
            {hasAnyServices ? (
                <>
                    {/* Main Dashboard Grid */}
                    {isAdmin ? (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Resource Usage - Only for admin */}
                            <div className="lg:col-span-2">
                                <ResourceUsageCard usage={resourceUsage} />
                            </div>
                            {/* Quick Actions */}
                            <div>
                                <QuickActions />
                            </div>
                        </div>
                    ) : (
                        // Regular User - Only Quick Actions
                        <div className="grid grid-cols-1 gap-6">
                            <QuickActions />
                        </div>
                    )}

                    {/* Hosting Services - Admin Only */}
                    {isAdmin && hostingServices.length > 0 && (
                        <div>
                            <h2 className="text-xl font-bold mb-4">Hosting Services</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {hostingServices.map(service => (
                                    <HostingCard key={service.id} service={service} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Domain Services - Admin Only */}
                    {isAdmin && domainServices.length > 0 && (
                        <div>
                            <h2 className="text-xl font-bold mb-4">Domains</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {domainServices.map(service => (
                                    <DomainCard key={service.id} service={service} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Email Services - Admin Only */}
                    {isAdmin && emailServices.length > 0 && (
                        <div>
                            <h2 className="text-xl font-bold mb-4">Email Services</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {emailServices.map(service => (
                                    <EmailCard key={service.id} service={service} />
                                ))}
                            </div>
                        </div>
                    )}
                </>
            ) : (
                /* Empty State for Regular Users */
                <div className="py-16">
                    <div className="max-w-3xl mx-auto text-center">
                        <div className="w-24 h-24 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Server className="w-12 h-12 text-brand-purple" />
                        </div>
                        <h2 className="text-2xl font-bold text-brand-navy mb-3">
                            You Haven't Hosted Anything Yet
                        </h2>
                        <p className="text-gray-600 mb-8 max-w-xl mx-auto">
                            Start your journey by setting up your first hosting service, registering a domain, or creating an email account.
                        </p>

                        {/* Quick Start Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                            <div className="border border-gray-200 rounded-lg p-6 hover:border-brand-purple transition-colors cursor-pointer"
                                onClick={() => navigate('/hosting')}>
                                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                                    <Server className="w-6 h-6 text-blue-600" />
                                </div>
                                <h3 className="font-semibold text-brand-navy mb-2">Create Hosting</h3>
                                <p className="text-sm text-gray-600">
                                    Deploy your website with our powerful hosting platform
                                </p>
                            </div>

                            <div className="border border-gray-200 rounded-lg p-6 hover:border-brand-purple transition-colors cursor-pointer"
                                onClick={() => navigate('/domains/search')}>
                                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                                    <Globe className="w-6 h-6 text-green-600" />
                                </div>
                                <h3 className="font-semibold text-brand-navy mb-2">Register Domain</h3>
                                <p className="text-sm text-gray-600">
                                    Find and register your perfect domain name
                                </p>
                            </div>

                            <div className="border border-gray-200 rounded-lg p-6 hover:border-brand-purple transition-colors cursor-pointer"
                                onClick={() => navigate('/email')}>
                                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                                    <Mail className="w-6 h-6 text-brand-purple" />
                                </div>
                                <h3 className="font-semibold text-brand-navy mb-2">Setup Email</h3>
                                <p className="text-sm text-gray-600">
                                    Create professional email accounts for your domain
                                </p>
                            </div>
                        </div>

                        <Button variant="primary" size="lg" onClick={() => navigate('/hosting')}>
                            <Plus className="w-5 h-5 mr-2" />
                            Get Started
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
