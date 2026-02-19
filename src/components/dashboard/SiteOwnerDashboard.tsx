
import { useEffect, useState } from 'react'
import { Plus, Globe, Search, ArrowRight, Settings, ExternalLink } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore, useHasHydrated } from '@/store/authStore'
import { wordpressAPI } from '@/lib/wordpressAPI'

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

    useEffect(() => {
        if (hydrated && isAuthenticated) {
            fetchSites()
        } else if (hydrated && !isAuthenticated) {
            setIsLoading(false)
        }
    }, [hydrated, isAuthenticated])

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
    const projectLimit = user?.project_quota || 5
    const projectsUsed = sites.length
    const usagePercentage = Math.min((projectsUsed / projectLimit) * 100, 100)

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
                            <span className="text-gray-500">{projectsUsed} of {projectLimit} projects</span>
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
                        disabled={projectsUsed >= projectLimit}
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

            {/* Sites Grid */}
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
    )
}
