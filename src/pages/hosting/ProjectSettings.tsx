
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TeamManagement } from '@/components/team/TeamManagement'
import { AuditLogViewer } from '@/components/audit/AuditLogViewer'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
    wordpressAPI,
    type WordPressSite,
    type ProjectService,
    type ApiRoute,
    type GatewayApplyJob,
    type GatewayDiscoveryContainer,
} from '@/lib/wordpressAPI'
import { Loader2, Zap, AlertTriangle, CheckCircle2, Server, Minus, Plus, Network, Route, Trash2, RefreshCcw } from 'lucide-react'

export function ProjectSettings() {
    const { id } = useParams<{ id: string }>()
    const [site, setSite] = useState<WordPressSite | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const fetchSite = async () => {
            if (!id) return
            try {
                const site = await wordpressAPI.getSite(parseInt(id))
                setSite(site)
            } catch (error: any) {
                console.error('Failed to fetch site', error)
                setError(error?.message || 'Failed to load site')
            } finally {
                setLoading(false)
            }
        }
        fetchSite()
    }, [id])

    if (!id) return null

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-brand-purple" />
            </div>
        )
    }

    if (!site) return (
        <div className="p-8 text-center">
            <p className="text-red-600 font-semibold text-lg">Failed to load site</p>
            {error && <p className="text-gray-500 text-sm mt-2 font-mono">{error}</p>}
        </div>
    )

    const isFullStack = site.framework === 'react_django'

    return (
        <div className="space-y-6">
            <Breadcrumbs
                items={[
                    { label: 'Hosting', to: '/hosting' },
                    { label: site.name, to: '#' },
                    { label: 'Project Settings' }
                ]}
            />

            <div>
                <h1 className="text-3xl font-bold text-brand-navy">Project Settings</h1>
                <p className="text-gray-600 mt-1">Configuration for {site.name}</p>
            </div>

            <Tabs defaultValue="general" className="w-full">
                <TabsList className="mb-4 flex flex-wrap h-auto">
                    <TabsTrigger value="general">General</TabsTrigger>
                    <TabsTrigger value="team">Team Members</TabsTrigger>
                    {isFullStack && (
                        <TabsTrigger value="lb" className="gap-2">
                            <Network className="w-4 h-4" />
                            Load Balancing
                        </TabsTrigger>
                    )}
                    {isFullStack && (
                        <TabsTrigger value="api-gateway" className="gap-2">
                            <Route className="w-4 h-4" />
                            API Gateway
                        </TabsTrigger>
                    )}
                    <TabsTrigger value="audit">Audit Logs</TabsTrigger>
                </TabsList>

                <TabsContent value="general">
                    <Card>
                        <CardHeader>
                            <CardTitle>General Configuration</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <h4 className="font-semibold text-sm text-gray-500">Site Name</h4>
                                    <p>{site.name}</p>
                                </div>
                                <div>
                                    <h4 className="font-semibold text-sm text-gray-500">Domain</h4>
                                    <p className="font-mono">{site.domain}</p>
                                </div>
                                {isFullStack && (
                                    <>
                                        <div>
                                            <h4 className="font-semibold text-sm text-gray-500">Repository</h4>
                                            <p className="truncate" title={site.repo_url}>{site.repo_url}</p>
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-sm text-gray-500">Branch</h4>
                                            <p>{site.branch}</p>
                                        </div>
                                    </>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="team">
                    <TeamManagement projectId={id} />
                </TabsContent>

                {isFullStack && (
                    <TabsContent value="lb">
                        <LoadBalancingPanel site={site} onUpdated={setSite} />
                    </TabsContent>
                )}

                {isFullStack && (
                    <TabsContent value="api-gateway">
                        <ApiGatewayPanel site={site} />
                    </TabsContent>
                )}

                <TabsContent value="audit">
                    <AuditLogViewer projectId={id} />
                </TabsContent>
            </Tabs>
        </div>
    )
}

// ---------------------------------------------------------------------------
// Load Balancing Panel (react_django only)
// ---------------------------------------------------------------------------

interface LoadBalancingPanelProps {
    site: WordPressSite
    onUpdated: (site: WordPressSite) => void
}

function LoadBalancingPanel({ site, onUpdated }: LoadBalancingPanelProps) {
    const [targetReplicas, setTargetReplicas] = useState(site.replica_count ?? 1)
    const [scaling, setScaling] = useState(false)
    const [result, setResult] = useState<{
        success: boolean
        message: string
        nginxStatus?: string
        ports?: number[]
    } | null>(null)

    const currentReplicas = site.replica_count ?? 1
    const isRunning = site.status === 'running'
    const lbApiUrl = site.port ? `http://localhost:${site.port}/api/` : null

    const handleScale = async () => {
        setScaling(true)
        setResult(null)
        try {
            const data = await wordpressAPI.scaleSite(site.id, targetReplicas)
            setResult({
                success: true,
                message: data.status,
                nginxStatus: data.nginx_reload,
                ports: data.backend_ports,
            })
            // Refresh site data locally
            onUpdated({
                ...site,
                replica_count: data.replica_count,
                backend_ports: data.backend_ports,
            })
        } catch (err: any) {
            setResult({ success: false, message: err.message || 'Scale operation failed' })
        } finally {
            setScaling(false)
        }
    }

    return (
        <div className="space-y-5">
            {/* Status Overview */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Zap className="w-5 h-5 text-indigo-500" />
                        Load Balancing — Django Backend
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-3 gap-4 text-center mb-6">
                        <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                            <p className="text-3xl font-bold text-indigo-700">{currentReplicas}</p>
                            <p className="text-xs text-gray-500 mt-1">Current Replicas</p>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-xl border">
                            <p className="text-sm font-semibold text-gray-700 mt-2">
                                {currentReplicas > 1 ? 'least_conn' : 'none'}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">Algorithm</p>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-xl border">
                            <p className="text-sm font-semibold text-gray-700 mt-1">
                                {isRunning ? (
                                    <span className="flex items-center justify-center gap-1 text-green-600">
                                        <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                                        Running
                                    </span>
                                ) : (
                                    <span className="text-amber-600">Stopped</span>
                                )}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">Site Status</p>
                        </div>
                    </div>

                    {/* Load Balanced API Link */}
                    {lbApiUrl && (
                        <div className="mb-5">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Load Balanced API</p>
                            <p className="text-xs text-gray-400 mb-3">
                                This endpoint routes <code className="bg-gray-100 px-1 rounded">/api/</code> through the load balancer.
                            </p>
                            <a
                                href={lbApiUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-800 rounded-full text-xs font-mono hover:bg-green-200 hover:text-green-900 transition-colors cursor-pointer"
                                title={`Open load balanced API at ${lbApiUrl}`}
                            >
                                <Server className="w-3 h-3" />
                                {lbApiUrl}
                            </a>
                        </div>
                    )}

                    {/* Backend Port List */}
                    {site.backend_ports && site.backend_ports.length > 0 && (
                        <div className="mb-5">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Active Backend Replicas</p>
                            <p className="text-xs text-gray-400 mb-3">These are Django API backends — click to open <code className="bg-gray-100 px-1 rounded">/api/</code> on each replica</p>
                            <div className="flex flex-wrap gap-2">
                                {site.backend_ports.map((port, i) => (
                                    <a
                                        key={port}
                                        href={`http://localhost:${port}/api/`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-100 text-indigo-800 rounded-full text-xs font-mono hover:bg-indigo-200 hover:text-indigo-900 transition-colors cursor-pointer"
                                        title={`Open replica ${i + 1} API at http://localhost:${port}/api/`}
                                    >
                                        <Server className="w-3 h-3" />
                                        localhost:{port}/api/
                                        <span className="text-indigo-500 opacity-70 ml-1">— replica {i + 1}</span>
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Replica Selector */}
                    <div className="border rounded-xl p-5 bg-gray-50">
                        <p className="text-sm font-semibold text-gray-700 mb-4">Set Replica Count</p>
                        <div className="flex items-center justify-center gap-6">
                            <button
                                onClick={() => setTargetReplicas(Math.max(1, targetReplicas - 1))}
                                disabled={targetReplicas <= 1}
                                className="w-10 h-10 rounded-full border-2 border-indigo-200 flex items-center justify-center text-indigo-600 hover:bg-indigo-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                <Minus className="w-4 h-4" />
                            </button>

                            <div className="flex gap-2">
                                {[1, 2, 3, 4, 5].map(n => (
                                    <button
                                        key={n}
                                        onClick={() => setTargetReplicas(n)}
                                        className={`w-10 h-10 rounded-full text-sm font-bold transition-all border-2 ${targetReplicas === n
                                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg scale-110'
                                            : 'border-gray-200 text-gray-600 hover:border-indigo-300 hover:bg-indigo-50'
                                            }`}
                                    >
                                        {n}
                                    </button>
                                ))}
                            </div>

                            <button
                                onClick={() => setTargetReplicas(Math.min(5, targetReplicas + 1))}
                                disabled={targetReplicas >= 5}
                                className="w-10 h-10 rounded-full border-2 border-indigo-200 flex items-center justify-center text-indigo-600 hover:bg-indigo-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>

                        <p className="text-center text-xs text-gray-500 mt-3">
                            {targetReplicas === 1
                                ? 'Single backend — no load balancing'
                                : `${targetReplicas} replicas → least_conn algorithm`}
                        </p>
                    </div>

                    {/* Scale Button */}
                    <div className="mt-5 flex items-center gap-3">
                        <button
                            onClick={handleScale}
                            disabled={scaling || !isRunning || targetReplicas === currentReplicas}
                            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-semibold text-sm
                                       hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                        >
                            {scaling ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /> Scaling...</>
                            ) : (
                                <><Zap className="w-4 h-4" /> Apply Scale</>
                            )}
                        </button>
                        {!isRunning && (
                            <p className="text-xs text-amber-600 flex items-center gap-1">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                Site must be running to scale
                            </p>
                        )}
                        {targetReplicas === currentReplicas && isRunning && (
                            <p className="text-xs text-gray-500">Already at {currentReplicas} replica(s)</p>
                        )}
                    </div>

                    {/* Result Feedback */}
                    {result && (
                        <div className={`mt-4 p-4 rounded-lg border text-sm flex items-start gap-3 ${result.success
                            ? 'bg-green-50 border-green-200 text-green-800'
                            : 'bg-red-50 border-red-200 text-red-800'
                            }`}>
                            {result.success
                                ? <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-green-600" />
                                : <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-600" />}
                            <div className="space-y-1">
                                <p className="font-medium">{result.message}</p>
                                {result.nginxStatus && (
                                    <p className="text-xs opacity-75">Nginx: {result.nginxStatus}</p>
                                )}
                                {result.ports && result.ports.length > 0 && (
                                    <p className="text-xs opacity-75 font-mono">
                                        Ports: {result.ports.join(', ')}
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Info box */}
            <div className="flex gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-500" />
                <div>
                    <p className="font-semibold mb-1">Only the Django API is load balanced</p>
                    <p className="text-xs leading-relaxed">
                        The React frontend is a single container serving pre-built static files — it doesn't need replicas.
                        WordPress sites are excluded because they require a shared filesystem (NFS) and centralized session
                        store (Redis) before horizontal scaling is safe.
                    </p>
                </div>
            </div>
        </div>
    )
}

// ---------------------------------------------------------------------------
// API Gateway Panel (react_django only)
// ---------------------------------------------------------------------------

interface ApiGatewayPanelProps {
    site: WordPressSite
}

function ApiGatewayPanel({ site }: ApiGatewayPanelProps) {
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [services, setServices] = useState<ProjectService[]>([])
    const [routes, setRoutes] = useState<ApiRoute[]>([])
    const [containerOptions, setContainerOptions] = useState<GatewayDiscoveryContainer[]>([])
    const [gatewayStatus, setGatewayStatus] = useState<{
        last_synced_at: string | null;
        last_error: string;
        config_hash: string;
        latest_job: GatewayApplyJob | null;
    } | null>(null)
    const [error, setError] = useState<string | null>(null)

    const [serviceName, setServiceName] = useState('')
    const [containerName, setContainerName] = useState('')
    const [internalPort, setInternalPort] = useState(8000)

    const [routePath, setRoutePath] = useState('')
    const [routeServiceId, setRouteServiceId] = useState<number | null>(null)
    const [stripPrefix, setStripPrefix] = useState(true)
    const selectedContainer = containerOptions.find((row) => row.container_name === containerName) || null

    const refreshAll = async () => {
        try {
            setError(null)
            const [serviceRows, routeRows, statusRow, discoveryRow] = await Promise.all([
                wordpressAPI.getApiServices(site.id),
                wordpressAPI.getApiRoutes(site.id),
                wordpressAPI.getApiGatewayStatus(site.id),
                wordpressAPI.getApiGatewayDiscovery(site.id),
            ])
            setServices(serviceRows)
            setRoutes(routeRows)
            setGatewayStatus(statusRow)
            setContainerOptions(discoveryRow.containers)
            if (discoveryRow.containers.length > 0 && !discoveryRow.containers.some((row) => row.container_name === containerName)) {
                setContainerName('')
            }
            if (!routeServiceId && serviceRows.length > 0) {
                setRouteServiceId(serviceRows[0].id)
            }
        } catch (err: any) {
            setError(err?.message || 'Failed to load gateway data')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        setLoading(true)
        refreshAll()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [site.id])

    const handleCreateService = async () => {
        if (!serviceName.trim() || !containerName.trim()) {
            setError('Service name and container name are required.')
            return
        }

        setSaving(true)
        setError(null)
        try {
            await wordpressAPI.createApiService(site.id, {
                name: serviceName.trim(),
                container_name: containerName.trim(),
                internal_port: internalPort,
                protocol: 'http',
                is_active: true,
            })
            setServiceName('')
            setContainerName('')
            setInternalPort(8000)
            await refreshAll()
        } catch (err: any) {
            setError(err?.message || 'Failed to create API service')
        } finally {
            setSaving(false)
        }
    }

    const handleContainerSelect = (value: string) => {
        setContainerName(value)
        const option = containerOptions.find((row) => row.container_name === value)
        if (!option) return

        if (!serviceName.trim()) {
            setServiceName(option.suggested_service_name)
        }
        if (option.default_internal_port) {
            setInternalPort(option.default_internal_port)
        }
    }

    const handleDeleteService = async (serviceId: number) => {
        setSaving(true)
        setError(null)
        try {
            await wordpressAPI.deleteApiService(site.id, serviceId)
            await refreshAll()
        } catch (err: any) {
            setError(err?.message || 'Failed to delete API service')
        } finally {
            setSaving(false)
        }
    }

    const handleCreateRoute = async () => {
        if (!routeServiceId) {
            setError('Select a target service for this route.')
            return
        }
        if (!routePath.trim()) {
            setError('Route path is required (for example: payments).')
            return
        }

        setSaving(true)
        setError(null)
        try {
            await wordpressAPI.createApiRoute(site.id, {
                service: routeServiceId,
                path: routePath.trim(),
                strip_prefix: stripPrefix,
                is_enabled: true,
            })
            setRoutePath('')
            setStripPrefix(true)
            await refreshAll()
        } catch (err: any) {
            setError(err?.message || 'Failed to create API route')
        } finally {
            setSaving(false)
        }
    }

    const handleDeleteRoute = async (routeId: number) => {
        setSaving(true)
        setError(null)
        try {
            await wordpressAPI.deleteApiRoute(site.id, routeId)
            await refreshAll()
        } catch (err: any) {
            setError(err?.message || 'Failed to delete API route')
        } finally {
            setSaving(false)
        }
    }

    const handleManualApply = async () => {
        setSaving(true)
        setError(null)
        try {
            await wordpressAPI.applyApiGateway(site.id)
            await refreshAll()
        } catch (err: any) {
            setError(err?.message || 'Failed to queue API gateway apply')
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-48">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
            </div>
        )
    }

    return (
        <div className="space-y-5">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                            <Route className="w-5 h-5 text-indigo-600" />
                            API Gateway Routes
                        </span>
                        <button
                            onClick={refreshAll}
                            disabled={saving}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium hover:bg-gray-50 disabled:opacity-50"
                        >
                            <RefreshCcw className="w-3.5 h-3.5" /> Refresh
                        </button>
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid md:grid-cols-3 gap-3 text-sm">
                        <div className="border rounded-lg p-3 bg-gray-50">
                            <p className="text-xs text-gray-500 uppercase tracking-wider">Gateway Sync</p>
                            <p className="font-medium mt-1">{gatewayStatus?.last_synced_at ? new Date(gatewayStatus.last_synced_at).toLocaleString() : 'Not synced yet'}</p>
                        </div>
                        <div className="border rounded-lg p-3 bg-gray-50 md:col-span-2">
                            <p className="text-xs text-gray-500 uppercase tracking-wider">Worker Status</p>
                            {gatewayStatus?.latest_job ? (
                                <p className="mt-1">
                                    <span className="font-medium">Job #{gatewayStatus.latest_job.id}</span>
                                    {' - '}
                                    <span className={`font-semibold ${
                                        gatewayStatus.latest_job.status === 'success'
                                            ? 'text-green-700'
                                            : gatewayStatus.latest_job.status === 'failed'
                                                ? 'text-red-600'
                                                : 'text-amber-600'
                                    }`}>
                                        {gatewayStatus.latest_job.status}
                                    </span>
                                </p>
                            ) : (
                                <p className="mt-1 text-gray-500">No jobs queued yet</p>
                            )}
                        </div>
                        <div className="border rounded-lg p-3 bg-gray-50 md:col-span-3">
                            <p className="text-xs text-gray-500 uppercase tracking-wider">Last Error</p>
                            <p className={`mt-1 ${gatewayStatus?.last_error ? 'text-red-600' : 'text-green-700'}`}>
                                {gatewayStatus?.last_error || 'None'}
                            </p>
                        </div>
                    </div>

                    <div>
                        <button
                            onClick={handleManualApply}
                            disabled={saving}
                            className="px-3 py-2 rounded-md bg-slate-700 text-white text-xs font-medium hover:bg-slate-800 disabled:opacity-50"
                        >
                            {saving ? 'Queueing...' : 'Queue Apply Now'}
                        </button>
                    </div>

                    {error && (
                        <div className="rounded-md border border-red-200 bg-red-50 text-red-700 text-sm p-3">
                            {error}
                        </div>
                    )}

                    <div className="border rounded-xl p-4 space-y-3">
                        <p className="text-sm font-semibold">1. Add Target Service</p>
                        <div className="grid md:grid-cols-4 gap-2">
                            <input
                                className="border rounded-md px-3 py-2 text-sm"
                                placeholder="users, payments, inventory"
                                value={serviceName}
                                onChange={(e) => setServiceName(e.target.value)}
                            />
                            <select
                                className="border rounded-md px-3 py-2 text-sm"
                                value={containerName}
                                onChange={(e) => handleContainerSelect(e.target.value)}
                            >
                                <option value="" disabled>Select running container</option>
                                {containerOptions.map((container) => (
                                    <option
                                        key={container.container_name}
                                        value={container.container_name}
                                        disabled={container.already_registered}
                                    >
                                        {container.container_name}
                                        {container.recommended_for_api ? '' : ' (not recommended)'}
                                        {container.already_registered ? ' (already used)' : ''}
                                    </option>
                                ))}
                            </select>
                            <input
                                type="number"
                                min={1}
                                max={65535}
                                className="border rounded-md px-3 py-2 text-sm"
                                placeholder="Internal port"
                                value={internalPort}
                                onChange={(e) => setInternalPort(Number(e.target.value || 0))}
                            />
                            <button
                                onClick={handleCreateService}
                                disabled={saving || !containerName}
                                className="px-3 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                            >
                                {saving ? 'Saving...' : 'Add Service'}
                            </button>
                        </div>
                        <p className="text-xs text-gray-500">
                            Service name should be a business label the owner understands, like <code className="bg-gray-100 px-1 rounded">users</code>, <code className="bg-gray-100 px-1 rounded">payments</code>, or <code className="bg-gray-100 px-1 rounded">orders</code>.
                        </p>
                        {selectedContainer && (
                            <p className="text-xs text-gray-500">
                                Selected container: <span className="font-mono">{selectedContainer.container_name}</span>
                                {selectedContainer.default_internal_port ? ` (default port ${selectedContainer.default_internal_port})` : ''}
                            </p>
                        )}
                        {containerOptions.length === 0 && (
                            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1">
                                No running containers discovered for this project. Start the project first.
                            </p>
                        )}

                        {services.length === 0 ? (
                            <p className="text-xs text-gray-500">No API services yet.</p>
                        ) : (
                            <div className="space-y-2">
                                {services.map((service) => (
                                    <div key={service.id} className="flex items-center justify-between border rounded-md p-2 text-sm">
                                        <div>
                                            <p className="font-medium">{service.name}</p>
                                            <p className="text-xs text-gray-500 font-mono">{service.container_name}:{service.internal_port}</p>
                                        </div>
                                        <button
                                            onClick={() => handleDeleteService(service.id)}
                                            disabled={saving}
                                            className="inline-flex items-center gap-1 text-red-600 text-xs hover:text-red-700 disabled:opacity-40"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" /> Delete
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="border rounded-xl p-4 space-y-3">
                        <p className="text-sm font-semibold">2. Add Route (supports nested paths like /api/v1/products)</p>
                        <div className="grid md:grid-cols-4 gap-2">
                            <input
                                className="border rounded-md px-3 py-2 text-sm"
                                placeholder="v1/products"
                                value={routePath}
                                onChange={(e) => setRoutePath(e.target.value)}
                            />
                            <select
                                className="border rounded-md px-3 py-2 text-sm"
                                value={routeServiceId ?? ''}
                                onChange={(e) => setRouteServiceId(e.target.value ? Number(e.target.value) : null)}
                            >
                                <option value="" disabled>Select service</option>
                                {services.map((service) => (
                                    <option key={service.id} value={service.id}>{service.name}</option>
                                ))}
                            </select>
                            <label className="inline-flex items-center gap-2 text-sm border rounded-md px-3 py-2">
                                <input
                                    type="checkbox"
                                    checked={stripPrefix}
                                    onChange={(e) => setStripPrefix(e.target.checked)}
                                />
                                Strip prefix
                            </label>
                            <button
                                onClick={handleCreateRoute}
                                disabled={saving || services.length === 0}
                                className="px-3 py-2 rounded-md bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
                            >
                                {saving ? 'Saving...' : 'Add Route'}
                            </button>
                        </div>

                        {routes.length === 0 ? (
                            <p className="text-xs text-gray-500">No custom API routes yet.</p>
                        ) : (
                            <div className="space-y-2">
                                {routes.map((route) => (
                                    <div key={route.id} className="flex items-center justify-between border rounded-md p-2 text-sm">
                                        <div>
                                            <p className="font-medium font-mono">{route.path}</p>
                                            <p className="text-xs text-gray-500">
                                                → {route.service_name} ({route.container_name}:{route.internal_port})
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => handleDeleteRoute(route.id)}
                                            disabled={saving}
                                            className="inline-flex items-center gap-1 text-red-600 text-xs hover:text-red-700 disabled:opacity-40"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" /> Delete
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
