import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Database, Server, Loader2, ChevronRight } from 'lucide-react'
import { wordpressAPI, type WordPressSite } from '@/lib/wordpressAPI'
import { DatabaseTab } from '@/components/site/DatabaseTab'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'

export function DatabaseManager() {
    const [sites, setSites] = useState<WordPressSite[]>([])
    const [selectedSite, setSelectedSite] = useState<WordPressSite | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadSites()
    }, [])

    const loadSites = async () => {
        try {
            setLoading(true)
            const data = await wordpressAPI.getSites()
            setSites(data)

            // Auto-select first site if available
            if (data.length > 0 && !selectedSite) {
                setSelectedSite(data[0])
            }
        } catch (error) {
            console.error('Failed to load sites:', error)
        } finally {
            setLoading(false)
        }
    }

    const getStatusBadge = (status: WordPressSite['status']) => {
        const variants: Record<WordPressSite['status'], { variant: 'default' | 'success' | 'warning' | 'error'; label: string }> = {
            provisioning: { variant: 'warning', label: 'Provisioning' },
            running: { variant: 'success', label: 'Running' },
            stopped: { variant: 'default', label: 'Stopped' },
            error: { variant: 'error', label: 'Error' },
        }
        const config = variants[status]
        return <Badge variant={config.variant}>{config.label}</Badge>
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-brand-purple" />
            </div>
        )
    }

    if (sites.length === 0) {
        return (
            <div className="space-y-6">
                <Breadcrumbs items={[{ label: 'Hosting' }, { label: 'Database Manager' }]} />

                <div className="py-16 text-center">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Database className="w-10 h-10 text-green-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-brand-navy mb-3">
                        No Sites Available
                    </h2>
                    <p className="text-gray-600 mb-6 max-w-md mx-auto">
                        You need to create a WordPress site first before you can access its database.
                    </p>
                    <Button variant="primary" onClick={() => window.location.href = '/hosting/create'}>
                        <Server className="w-4 h-4 mr-2" />
                        Create WordPress Site
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <Breadcrumbs items={[{ label: 'Hosting' }, { label: 'Database Manager' }]} />

            <div>
                <h1 className="text-3xl font-bold text-brand-navy">Database Manager</h1>
                <p className="text-gray-600 mt-1">Access and manage your WordPress databases</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Site Selection Sidebar */}
                <Card className="lg:col-span-1">
                    <CardHeader>
                        <CardTitle className="text-lg">Select Site</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y divide-gray-200">
                            {sites.map((site) => (
                                <button
                                    key={site.id}
                                    onClick={() => setSelectedSite(site)}
                                    className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${selectedSite?.id === site.id ? 'bg-purple-50 border-l-4 border-brand-purple' : ''
                                        }`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center space-x-2">
                                            <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
                                                <Server className="w-4 h-4 text-blue-600" />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-sm text-brand-navy">{site.name}</h3>
                                                <p className="text-xs text-gray-500">{site.domain}</p>
                                            </div>
                                        </div>
                                        {selectedSite?.id === site.id && (
                                            <ChevronRight className="w-4 h-4 text-brand-purple" />
                                        )}
                                    </div>
                                    <div className="flex items-center justify-between">
                                        {getStatusBadge(site.status)}
                                        <span className="text-xs text-gray-500">Port {site.port}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Database Credentials Panel */}
                <div className="lg:col-span-2">
                    {selectedSite ? (
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle>{selectedSite.name}</CardTitle>
                                        <p className="text-sm text-gray-600 mt-1">Database Connection Details</p>
                                    </div>
                                    <Database className="w-6 h-6 text-brand-purple" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <DatabaseTab siteId={selectedSite.id} />
                            </CardContent>
                        </Card>
                    ) : (
                        <Card>
                            <CardContent className="p-12 text-center">
                                <Database className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                                <p className="text-gray-600">Select a site to view database credentials</p>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    )
}
