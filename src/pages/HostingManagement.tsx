import { useEffect, useState } from 'react'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Server, Plus, Play, Square, Trash2, ExternalLink, Loader2, Globe, Copy, Check, FolderOpen, Users, Code } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { wordpressAPI, type WordPressSite } from '@/lib/wordpressAPI'
import { ResourceMonitor } from '@/components/hosting/ResourceMonitor'
import { useToast } from '@/components/ui/toast'
import { copyToClipboard } from '@/lib/clipboardUtils'
import FileBrowserCredentialsModal from '@/components/FileBrowserCredentialsModal'
import DeleteConfirmationModal from '@/components/DeleteConfirmationModal'
import { useAuthStore, useHasHydrated } from '@/store/authStore'

export function HostingManagement() {
    const navigate = useNavigate()
    const { addToast } = useToast()
    const { isAuthenticated } = useAuthStore()
    const hydrated = useHasHydrated()
    const [sites, setSites] = useState<WordPressSite[]>([])
    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState<number | null>(null)
    const [tunnelLoading, setTunnelLoading] = useState<number | null>(null)
    const [copiedUrl, setCopiedUrl] = useState<number | null>(null)
    const [fileBrowserModal, setFileBrowserModal] = useState<{
        isOpen: boolean
        credentials: { username: string; password: string; url: string } | null
    }>({ isOpen: false, credentials: null })
    const [deleteModal, setDeleteModal] = useState<{
        isOpen: boolean
        siteId: number | null
        siteName: string
    }>({ isOpen: false, siteId: null, siteName: '' })

    const loadSites = async () => {
        try {
            const data = await wordpressAPI.getSites()
            setSites(data)
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

    useEffect(() => {
        if (hydrated && isAuthenticated) {
            loadSites()
        } else if (hydrated && !isAuthenticated) {
            setLoading(false)
        }
    }, [hydrated, isAuthenticated])

    const handleStart = async (id: number) => {
        setActionLoading(id)
        try {
            await wordpressAPI.startSite(id)
            addToast({
                title: 'Site Started',
                description: 'WordPress site is starting up',
                variant: 'success',
            })
            await loadSites()
        } catch (error) {
            addToast({
                title: 'Failed to start site',
                description: error instanceof Error ? error.message : 'Unknown error',
                variant: 'error',
            })
        } finally {
            setActionLoading(null)
        }
    }

    const handleStop = async (id: number) => {
        setActionLoading(id)
        try {
            await wordpressAPI.stopSite(id)
            addToast({
                title: 'Site Stopped',
                description: 'WordPress site has been stopped',
                variant: 'success',
            })
            await loadSites()
        } catch (error) {
            addToast({
                title: 'Failed to stop site',
                description: error instanceof Error ? error.message : 'Unknown error',
                variant: 'error',
            })
        } finally {
            setActionLoading(null)
        }
    }

    const handleDeleteClick = (id: number, name: string) => {
        setDeleteModal({ isOpen: true, siteId: id, siteName: name })
    }

    const handleConfirmDelete = async () => {
        const { siteId, siteName } = deleteModal
        if (!siteId) return

        setActionLoading(siteId)
        try {
            await wordpressAPI.deleteSite(siteId)
            addToast({
                title: 'Site Deleted',
                description: `${siteName} has been permanently deleted`,
                variant: 'success',
            })
            setDeleteModal({ isOpen: false, siteId: null, siteName: '' })
            await loadSites()
        } catch (error) {
            console.error('Delete error:', error)
            addToast({
                title: 'Failed to delete site',
                description: error instanceof Error ? error.message : 'Unknown error',
                variant: 'error',
            })
        } finally {
            setActionLoading(null)
        }
    }

    const handleGoLive = async (id: number) => {
        setTunnelLoading(id)
        try {
            const { public_url } = await wordpressAPI.enablePublicAccess(id)
            addToast({
                title: 'Public Access Enabled',
                description: `Site is now live at ${public_url}`,
                variant: 'success',
            })
            await loadSites()
        } catch (error) {
            addToast({
                title: 'Failed to enable public access',
                description: error instanceof Error ? error.message : 'Unknown error',
                variant: 'error',
            })
        } finally {
            setTunnelLoading(null)
        }
    }

    const handleGoLocal = async (id: number) => {
        setTunnelLoading(id)
        try {
            await wordpressAPI.disablePublicAccess(id)
            addToast({
                title: 'Public Access Disabled',
                description: 'Site is now local only',
                variant: 'success',
            })
            await loadSites()
        } catch (error) {
            addToast({
                title: 'Failed to disable public access',
                description: error instanceof Error ? error.message : 'Unknown error',
                variant: 'error',
            })
        } finally {
            setTunnelLoading(null)
        }
    }

    const handleCopyUrl = async (siteId: number, url: string) => {
        const success = await copyToClipboard(url)
        if (success) {
            setCopiedUrl(siteId)
            addToast({
                title: 'Copied!',
                description: 'Public URL copied to clipboard',
                variant: 'success',
            })
            setTimeout(() => setCopiedUrl(null), 2000)
        } else {
            addToast({
                title: 'Failed to copy',
                description: 'Please copy the URL manually',
                variant: 'error',
            })
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

    return (
        <div className="space-y-6">
            <Breadcrumbs items={[{ label: 'Hosting' }]} />

            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-brand-navy">Hosting & Sites</h1>
                    <p className="text-gray-600 mt-1">Manage your local WordPress and Full Stack applications</p>
                </div>
                <div className="flex gap-3">
                    <Button variant="outline" onClick={() => navigate('/hosting/create-fullstack')}>
                        <Code className="w-4 h-4 mr-2" />
                        New Full Stack App
                    </Button>
                    <Button variant="primary" onClick={() => navigate('/hosting/create')}>
                        <Plus className="w-4 h-4 mr-2" />
                        New WordPress Site
                    </Button>
                </div>
            </div>

            {sites.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {sites.map((site) => (
                        <Card key={site.id}>
                            <CardContent className="p-6">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center space-x-3">
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${site.framework === 'react_django' ? 'bg-purple-100' : 'bg-blue-100'}`}>
                                            {site.framework === 'react_django' ? (
                                                <Code className="w-5 h-5 text-purple-600" />
                                            ) : (
                                                <Server className="w-5 h-5 text-blue-600" />
                                            )}
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-brand-navy">{site.name}</h3>
                                            <p className="text-xs text-gray-500">Port {site.port}</p>
                                        </div>
                                    </div>
                                    {getStatusBadge(site.status)}
                                </div>

                                <div className="space-y-2 mb-4">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-600">Domain:</span>
                                        <span className="font-mono text-xs">{site.domain}</span>
                                    </div>

                                    {site.framework === 'react_django' ? (
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-gray-600">Repo:</span>
                                            <span className="text-xs truncate max-w-[150px]" title={site.repo_url}>
                                                {site.repo_url?.split('/').pop()} ({site.branch})
                                            </span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-gray-600">Admin:</span>
                                            <span className="text-xs">{site.admin_username}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="mb-4">
                                    <ResourceMonitor siteId={site.id} isRunning={site.status === 'running'} />
                                </div>

                                {/* Public Access Status & Controls */}
                                {site.public_access_enabled && site.public_url && (
                                    <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center space-x-2">
                                                <Globe className="w-4 h-4 text-green-600" />
                                                <span className="text-sm font-semibold text-green-700">Public</span>
                                            </div>
                                            <Badge variant="success">Live</Badge>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <input
                                                type="text"
                                                value={site.public_url}
                                                readOnly
                                                className="flex-1 text-xs font-mono bg-white border border-green-300 rounded px-2 py-1 text-gray-700"
                                            />
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleCopyUrl(site.id, site.public_url!)}
                                                className="shrink-0"
                                            >
                                                {copiedUrl === site.id ? (
                                                    <Check className="w-4 h-4 text-green-600" />
                                                ) : (
                                                    <Copy className="w-4 h-4" />
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {/* Go Live Toggle */}
                                {site.status === 'running' && (
                                    <div className="mb-4">
                                        {site.public_access_enabled ? (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleGoLocal(site.id)}
                                                disabled={tunnelLoading === site.id}
                                                className="w-full"
                                            >
                                                {tunnelLoading === site.id ? (
                                                    <>
                                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                        Disabling Public Access...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Square className="w-4 h-4 mr-2" />
                                                        Go Local
                                                    </>
                                                )}
                                            </Button>
                                        ) : (
                                            <Button
                                                variant="primary"
                                                size="sm"
                                                onClick={() => handleGoLive(site.id)}
                                                disabled={tunnelLoading === site.id}
                                                className="w-full"
                                            >
                                                {tunnelLoading === site.id ? (
                                                    <>
                                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                        Enabling Public Access...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Globe className="w-4 h-4 mr-2" />
                                                        Go Live
                                                    </>
                                                )}
                                            </Button>
                                        )}
                                    </div>
                                )}

                                <div className="flex items-center space-x-2">
                                    {site.status === 'stopped' || site.status === 'provisioning' ? (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleStart(site.id)}
                                            disabled={actionLoading === site.id}
                                        >
                                            {actionLoading === site.id ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Play className="w-4 h-4" />
                                            )}
                                        </Button>
                                    ) : (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleStop(site.id)}
                                            disabled={actionLoading === site.id}
                                        >
                                            {actionLoading === site.id ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Square className="w-4 h-4" />
                                            )}
                                        </Button>
                                    )}

                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => window.open(`http://localhost:${site.port}`, '_blank')}
                                        disabled={site.status !== 'running'}
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                    </Button>

                                    {/* Conditional Actions based on Framework */}
                                    {site.framework === 'wordpress' || !site.framework ? (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={async () => {
                                                try {
                                                    const creds = await wordpressAPI.getFileBrowserCredentials(site.id)
                                                    setFileBrowserModal({ isOpen: true, credentials: creds })
                                                } catch (error) {
                                                    addToast({
                                                        title: 'Failed to load credentials',
                                                        description: error instanceof Error ? error.message : 'Unknown error',
                                                        variant: 'error',
                                                    })
                                                }
                                            }}
                                            title="Open File Manager"
                                        >
                                            <FolderOpen className="w-4 h-4" />
                                        </Button>
                                    ) : (
                                        // TODO: Add Build Logs or Env Vars button here for React+Django
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            // onClick={() => ...}
                                            title="Build Logs (Coming Soon)"
                                            disabled
                                        >
                                            <Code className="w-4 h-4" />
                                        </Button>
                                    )}

                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => navigate(`/sites/${site.id}/domains`)}
                                        title="Manage Custom Domains"
                                    >
                                        <Globe className="w-4 h-4" />
                                    </Button>

                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => navigate(`/hosting/${site.id}/settings`)}
                                        title="Project Settings & Team"
                                    >
                                        <Users className="w-4 h-4" />
                                    </Button>

                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            handleDeleteClick(site.id, site.name)
                                        }}
                                        disabled={actionLoading === site.id}
                                    >
                                        {actionLoading === site.id ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Trash2 className="w-4 h-4 text-red-600" />
                                        )}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                /* Empty State */
                <div className="py-16 text-center">
                    <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Server className="w-10 h-10 text-blue-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-brand-navy mb-3">
                        No Sites Yet
                    </h2>
                    <p className="text-gray-600 mb-6 max-w-md mx-auto">
                        You haven't created any sites. Get started by deploying your first application.
                    </p>
                    <div className="flex justify-center gap-4">
                        <Button variant="outline" onClick={() => navigate('/hosting/create-fullstack')}>
                            <Code className="w-4 h-4 mr-2" />
                            New Full Stack App
                        </Button>
                        <Button variant="primary" onClick={() => navigate('/hosting/create')}>
                            <Plus className="w-4 h-4 mr-2" />
                            New WordPress Site
                        </Button>
                    </div>
                </div>
            )}

            {/* Modals */}
            {fileBrowserModal.credentials && (
                <FileBrowserCredentialsModal
                    isOpen={fileBrowserModal.isOpen}
                    onClose={() => setFileBrowserModal({ ...fileBrowserModal, isOpen: false })}
                    credentials={fileBrowserModal.credentials || { username: '', password: '', url: '' }}
                />
            )}

            <DeleteConfirmationModal
                isOpen={deleteModal.isOpen}
                onClose={() => setDeleteModal({ isOpen: false, siteId: null, siteName: '' })}
                onConfirm={handleConfirmDelete}
                siteName={deleteModal.siteName}
                isLoading={actionLoading === deleteModal.siteId}
            />
        </div>
    )
}
