import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FolderOpen, ExternalLink, Server, AlertTriangle } from 'lucide-react'
import { wordpressAPI, type WordPressSite } from '@/lib/wordpressAPI'
import { FileManagerTab } from '@/components/site/FileManagerTab'
import { useToast } from '@/components/ui/toast'

export function FileManager() {
    const { addToast } = useToast()
    const [sites, setSites] = useState<WordPressSite[]>([])
    const [selectedSite, setSelectedSite] = useState<number | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadSites()
    }, [])

    const loadSites = async () => {
        try {
            const data = await wordpressAPI.getSites()
            setSites(data.filter(site => site.status === 'running'))

            // Auto-select first running site if available
            if (data.length > 0 && data[0].status === 'running') {
                setSelectedSite(data[0].id)
            }
        } catch (error) {
            addToast({
                title: 'Failed to load sites',
                description: error instanceof Error ? error.message : 'Unknown error',
                variant: 'error',
            })
        } finally {
            setLoading(false)
        }
    }

    const openFileBrowser = () => {
        window.open('https://files.edubricz.online', '_blank', 'noopener,noreferrer')
    }

    if (loading) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold text-brand-navy">File Manager</h1>
                    <p className="text-gray-600 mt-1">Manage your WordPress site files</p>
                </div>
                <Card>
                    <CardContent className="p-12 text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-purple mx-auto"></div>
                        <p className="text-gray-600 mt-4">Loading sites...</p>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-brand-navy">File Manager</h1>
                    <p className="text-gray-600 mt-1">Manage your WordPress site files</p>
                </div>
                <Button onClick={openFileBrowser} variant="primary">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Open FileBrowser
                </Button>
            </div>

            {/* Info Alert */}
            <div className="flex gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <FolderOpen className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                    <strong>FileBrowser Access:</strong> Use the button above to open the file manager in a new tab,
                    or select a site below to view its specific file manager details and disk usage.
                </div>
            </div>

            {sites.length === 0 ? (
                <Card>
                    <CardContent className="p-12 text-center">
                        <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold mb-2">No Running Sites</h3>
                        <p className="text-gray-600 mb-4">
                            You need at least one running WordPress site to use the file manager.
                        </p>
                        <Button onClick={() => window.location.href = '/hosting/create'}>
                            Create WordPress Site
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <>
                    {/* Site Selection */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Select a Site</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {sites.map((site) => (
                                    <button
                                        key={site.id}
                                        onClick={() => setSelectedSite(site.id)}
                                        className={`p-4 rounded-lg border-2 transition-all text-left ${selectedSite === site.id
                                            ? 'border-brand-purple bg-purple-50'
                                            : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                                <Server className="w-5 h-5 text-blue-600" />
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="font-semibold text-brand-navy">{site.name}</h3>
                                                <p className="text-xs text-gray-500">{site.domain}</p>
                                            </div>
                                            {selectedSite === site.id && (
                                                <Badge variant="success">Selected</Badge>
                                            )}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* File Manager Tab for Selected Site */}
                    {selectedSite && <FileManagerTab siteId={selectedSite} />}
                </>
            )}
        </div>
    )
}
