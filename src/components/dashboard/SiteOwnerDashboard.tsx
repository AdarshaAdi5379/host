
import { useEffect, useState } from 'react'
import { Plus, Globe, Search, ArrowRight, Settings, ExternalLink, HardDrive, Cpu, MemoryStick } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore, useHasHydrated } from '@/store/authStore'
import { wordpressAPI } from '@/lib/wordpressAPI'
import { QuickActions } from '@/components/dashboard/QuickActions'

// Since we don't have this type exported yet, defining locally for now
interface Site {
    id: number
    name: string
    domain: string
    status: 'provisioning' | 'running' | 'stopped' | 'error'
    created_at: string
    public_url?: string | null
    public_access_enabled: boolean
}

export function SiteOwnerDashboard() {
    const navigate = useNavigate()
    const { user, isAuthenticated } = useAuthStore()
    const hydrated = useHasHydrated()
    const [sites, setSites] = useState<Site[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')

    // Aggregate telemetry across all running sites
    interface AggStats { cpu: number; ram: number; running_sites: number; sites_with_stats: number }
    const [aggStats, setAggStats] = useState<AggStats | null>(null)

    useEffect(() => {
        if (hydrated && isAuthenticated) {
            fetchSites()
            fetchAggStats()
            const interval = setInterval(fetchAggStats, 30000)
            return () => clearInterval(interval)
        } else if (hydrated && !isAuthenticated) {
            setIsLoading(false)
        }
    }, [hydrated, isAuthenticated])

    const fetchAggStats = async () => {
        try {
            const data = await wordpressAPI.getAggregateStats()
            setAggStats({ cpu: data.cpu, ram: data.ram, running_sites: data.running_sites, sites_with_stats: data.sites_with_stats })
        } catch { /* silent — non-critical */ }
    }

    const fetchSites = async () => {
        try {
            const data = await wordpressAPI.getSites()
            setSites(data)
        } catch (error) {
            console.error('Failed to fetch sites:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const filteredSites = sites.filter(site =>
        site.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        site.domain.toLowerCase().includes(searchQuery.toLowerCase())
    )

    // Calculate quota usage
    const isUnlimited = user?.platform_role === 'super_admin' || user?.project_quota === 0
    const projectLimit = isUnlimited ? Infinity : (user?.project_quota ?? 5)
    const projectsUsed = sites.length
    const usagePercentage = isUnlimited ? 0 : Math.min((projectsUsed / projectLimit) * 100, 100)

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-brand-purple to-brand-blue bg-clip-text text-transparent">
                        My Projects
                    </h1>
                    <p className="text-gray-500">Manage your WordPress deployments</p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="hidden md:block w-48">
                        <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-500">{projectsUsed} of {isUnlimited ? 'Unlimited' : projectLimit} projects</span>
                            <span className="font-medium text-brand-purple">{Math.round(usagePercentage)}%</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-brand-purple rounded-full transition-all duration-500"
                                style={{ width: `${usagePercentage}%` }}
                            />
                        </div>
                    </div>

                    <Button
                        onClick={() => navigate('/hosting/create')}
                        className="bg-brand-purple hover:bg-brand-purple/90"
                        disabled={!isUnlimited && projectsUsed >= projectLimit}
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        New Project
                    </Button>
                </div>
            </div>

            {/* Search */}
            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                    placeholder="Search projects..."
                    className="pl-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            {/* Main layout: sites grid + sidebar */}
            <div className="flex flex-col xl:flex-row gap-8">

                {/* Sites Grid */}
                <div className="flex-1 min-w-0">
                    {isLoading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-48 bg-gray-100 rounded-xl animate-pulse" />
                            ))}
                        </div>
                    ) : filteredSites.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredSites.map(site => (
                                <Card key={site.id} className="group relative overflow-hidden border-gray-200 hover:border-brand-purple/30 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                                    <div className="p-6">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                                                <Globe className="w-5 h-5 text-blue-600" />
                                            </div>
                                            <Badge
                                                variant="outline"
                                                className={
                                                    site.status === 'running' ? 'bg-green-50 text-green-700 border-green-200' :
                                                        site.status === 'provisioning' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                                            'bg-gray-50 text-gray-700 border-gray-200'
                                                }
                                            >
                                                {site.status === 'provisioning' ? 'Provisioning...' : site.status}
                                            </Badge>
                                        </div>

                                        <h3 className="text-lg font-semibold mb-1 group-hover:text-brand-purple transition-colors">
                                            {site.name}
                                        </h3>
                                        <p className="text-sm text-gray-500 mb-6 truncate">{site.domain}</p>

                                        <div className="space-y-3">
                                            {site.public_access_enabled && site.public_url && (
                                                <a
                                                    href={site.public_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center text-sm text-green-600 hover:text-green-700 hover:underline"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <ExternalLink className="w-3 h-3 mr-1.5" />
                                                    {site.public_url.replace('https://', '')}
                                                </a>
                                            )}

                                            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="flex-1 justify-start text-gray-600 hover:text-brand-purple hover:bg-purple-50"
                                                    onClick={() => navigate('/hosting')}
                                                >
                                                    <Settings className="w-4 h-4 mr-2" />
                                                    Manage
                                                </Button>
                                                <Link
                                                    to="/hosting"
                                                    className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-brand-purple transition-colors"
                                                >
                                                    <ArrowRight className="w-4 h-4" />
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                                <Plus className="w-6 h-6 text-brand-purple" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-1">No projects found</h3>
                            <p className="text-gray-500 mb-6">Get started by creating your first WordPress deployment</p>
                            <Button
                                onClick={() => navigate('/hosting/create')}
                                className="bg-brand-purple hover:bg-brand-purple/90"
                            >
                                Create Project
                            </Button>
                        </div>
                    )}
                </div>

                {/* Sidebar: Quick Actions + Resource Usage */}
                <div className="w-full xl:w-80 shrink-0 space-y-6">

                    {/* Quick Actions */}
                    <QuickActions />

                    {/* Total Resource Usage */}
                    <div className="rounded-xl border border-gray-200 bg-white p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <HardDrive className="w-4 h-4 text-brand-purple" />
                            <h2 className="text-sm font-semibold text-gray-700">Resource Usage</h2>
                        </div>

                        {/* Project Quota */}
                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between text-xs mb-1.5">
                                    <span className="text-gray-500">Projects</span>
                                    <span className="font-medium text-gray-800">
                                        {projectsUsed} / {isUnlimited ? '∞' : projectLimit}
                                    </span>
                                </div>
                                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-500 ${usagePercentage > 80 ? 'bg-red-500' :
                                            usagePercentage > 50 ? 'bg-orange-400' : 'bg-brand-purple'
                                            }`}
                                        style={{ width: isUnlimited ? '8%' : `${usagePercentage}%` }}
                                    />
                                </div>
                                {isUnlimited && (
                                    <p className="text-xs text-brand-purple mt-1">Unlimited quota — Super Admin</p>
                                )}
                            </div>

                            {/* Site status summary */}
                            <div className="pt-3 border-t border-gray-100 grid grid-cols-3 gap-2 text-center">
                                <div className="rounded-lg bg-green-50 p-2">
                                    <p className="text-lg font-bold text-green-700">
                                        {sites.filter(s => s.status === 'running').length}
                                    </p>
                                    <p className="text-xs text-green-600">Running</p>
                                </div>
                                <div className="rounded-lg bg-yellow-50 p-2">
                                    <p className="text-lg font-bold text-yellow-700">
                                        {sites.filter(s => s.status === 'provisioning').length}
                                    </p>
                                    <p className="text-xs text-yellow-600">Building</p>
                                </div>
                                <div className="rounded-lg bg-gray-100 p-2">
                                    <p className="text-lg font-bold text-gray-700">
                                        {sites.filter(s => s.status === 'stopped' || s.status === 'error').length}
                                    </p>
                                    <p className="text-xs text-gray-500">Stopped</p>
                                </div>
                            </div>

                            {/* Live telemetry */}
                            <div className="pt-3 border-t border-gray-100 space-y-3">
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Live Telemetry</p>

                                {/* CPU */}
                                <div>
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className="flex items-center gap-1 text-gray-500"><Cpu className="w-3 h-3" /> CPU</span>
                                        <span className="font-medium text-gray-800">{aggStats ? `${aggStats.cpu.toFixed(1)}%` : '—'}</span>
                                    </div>
                                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-700 ${(aggStats?.cpu ?? 0) > 80 ? 'bg-red-500' :
                                                    (aggStats?.cpu ?? 0) > 50 ? 'bg-orange-400' : 'bg-blue-500'
                                                }`}
                                            style={{ width: `${Math.min(aggStats?.cpu ?? 0, 100)}%` }}
                                        />
                                    </div>
                                </div>

                                {/* RAM */}
                                <div>
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className="flex items-center gap-1 text-gray-500"><MemoryStick className="w-3 h-3" /> RAM</span>
                                        <span className="font-medium text-gray-800">
                                            {aggStats ? (aggStats.ram >= 1024 ? `${(aggStats.ram / 1024).toFixed(1)} GB` : `${aggStats.ram.toFixed(0)} MB`) : '—'}
                                        </span>
                                    </div>
                                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full bg-purple-500 transition-all duration-700"
                                            style={{ width: `${Math.min(((aggStats?.ram ?? 0) / 4096) * 100, 100)}%` }}
                                        />
                                    </div>
                                </div>

                                {aggStats && (
                                    <p className="text-xs text-gray-400 text-right">
                                        {aggStats.sites_with_stats} container{aggStats.sites_with_stats !== 1 ? 's' : ''} reporting
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    )
}
