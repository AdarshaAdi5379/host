
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TeamManagement } from '@/components/team/TeamManagement'
import { AuditLogViewer } from '@/components/audit/AuditLogViewer'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { wordpressAPI, type WordPressSite } from '@/lib/wordpressAPI'
import { Loader2, Terminal } from 'lucide-react'

export function ProjectSettings() {
    const { id } = useParams<{ id: string }>()
    const [site, setSite] = useState<WordPressSite | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchSite = async () => {
            if (!id) return
            try {
                const sites = await wordpressAPI.getSites()
                const found = sites.find(s => s.id === parseInt(id))
                if (found) setSite(found)
            } catch (error) {
                console.error('Failed to fetch site', error)
            } finally {
                setLoading(false)
            }
        }
        fetchSite()
    }, [id])

    const [logs, setLogs] = useState<string>('')
    const [activeTab, setActiveTab] = useState('general')

    useEffect(() => {
        let interval: any
        if (activeTab === 'builds' && site?.framework === 'react_django') {
            const fetchLogs = async () => {
                if (!site) return
                try {
                    const data = await wordpressAPI.getBuildLogs(site.id)
                    setLogs(data.logs)
                } catch (e) {
                    console.error('Failed to fetch logs', e)
                }
            }
            fetchLogs()
            interval = setInterval(fetchLogs, 3000)
        }
        return () => clearInterval(interval)
    }, [activeTab, site])

    if (!id) return null

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-brand-purple" />
            </div>
        )
    }

    if (!site) return <div>Site not found</div>

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

            <Tabs defaultValue="general" className="w-full" onValueChange={setActiveTab}>
                <TabsList className="mb-4">
                    <TabsTrigger value="general">General</TabsTrigger>
                    <TabsTrigger value="team">Team Members</TabsTrigger>
                    {isFullStack && <TabsTrigger value="env">Environment Variables</TabsTrigger>}
                    {isFullStack && <TabsTrigger value="builds">Build Logs</TabsTrigger>}
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
                    <TabsContent value="env">
                        <Card>
                            <CardHeader>
                                <CardTitle>Environment Variables</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="p-4 bg-gray-50 rounded-md border text-sm font-mono">
                                    {site.env_vars ? (
                                        Object.entries(site.env_vars).map(([key, val]) => (
                                            <div key={key} className="flex gap-2">
                                                <span className="font-bold">{key}=</span>
                                                <span>{val ? '********' : ''}</span>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-gray-500 italic">No environment variables set.</p>
                                    )}
                                </div>
                                <p className="text-xs text-gray-500 mt-2">
                                    Variables are hidden for security. Updates coming soon.
                                </p>
                            </CardContent>
                        </Card>
                    </TabsContent>
                )}

                {isFullStack && (
                    <TabsContent value="builds">
                        <Card>
                            <CardHeader>
                                <CardTitle>Build Logs</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="h-96 bg-black text-green-400 p-4 rounded-md font-mono text-xs overflow-y-auto whitespace-pre-wrap">
                                    <div className="flex items-center gap-2 mb-2 border-b border-gray-800 pb-2">
                                        <Terminal className="w-4 h-4" />
                                        <span>Live Build Output</span>
                                    </div>
                                    {logs || 'Waiting for logs...'}
                                    <p className="animate-pulse mt-2">_</p>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                )}

                <TabsContent value="audit">
                    <AuditLogViewer projectId={id} />
                </TabsContent>
            </Tabs>
        </div>
    )
}
