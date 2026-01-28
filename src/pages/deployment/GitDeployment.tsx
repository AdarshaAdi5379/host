import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { GitBranch, Terminal, Clock, CheckCircle, XCircle, Play, UploadCloud, Github } from 'lucide-react'
import { GitConfigForm } from './components/GitConfigForm'
import { LogConsole } from './components/LogConsole'
import { DirectUpload } from './components/DirectUpload'
import { useToast } from '@/components/ui/toast'

interface Deployment {
    id: string
    branch: string
    commit: string
    status: 'success' | 'failed' | 'pending' | 'running'
    timestamp: string
    duration: string
    type: 'git' | 'manual'
}

const mockDeployments: Deployment[] = [
    {
        id: '1',
        branch: 'main',
        commit: 'a3f2c1d',
        status: 'success',
        timestamp: '2026-01-28 14:30',
        duration: '2m 15s',
        type: 'git',
    },
    {
        id: '2',
        branch: 'develop',
        commit: 'b7e8f9a',
        status: 'failed',
        timestamp: '2026-01-28 12:15',
        duration: '1m 45s',
        type: 'git',
    },
    {
        id: '3',
        branch: 'main',
        commit: 'c9d1e2f',
        status: 'success',
        timestamp: '2026-01-27 18:20',
        duration: '2m 30s',
        type: 'git',
    },
]

type Tab = 'git' | 'manual'

export function GitDeployment() {
    const { addToast } = useToast()
    const [activeTab, setActiveTab] = useState<Tab>('git')
    const [deployments, setDeployments] = useState<Deployment[]>(mockDeployments)
    const [isDeploying, setIsDeploying] = useState(false)
    const [showLogs, setShowLogs] = useState(false)
    const [activeDeployment, setActiveDeployment] = useState<Deployment | null>(null)

    const handleDeploy = (config: any) => {
        setIsDeploying(true)
        setShowLogs(true)
        addToast({
            title: 'Deployment Queued',
            description: 'Your build has been queued and will start shortly.',
        })

        // Create pending deployment
        const newDeployment: Deployment = {
            id: Date.now().toString(),
            branch: config.branch,
            commit: 'HEAD',
            status: 'running',
            timestamp: 'Just now',
            duration: '0s',
            type: 'git',
        }

        setActiveDeployment(newDeployment)

        // Add to history immediately
        setDeployments(prev => [newDeployment, ...prev])

        // Simulate build completion
        setTimeout(() => {
            setIsDeploying(false)
            setDeployments(prev => prev.map(d =>
                d.id === newDeployment.id
                    ? { ...d, status: 'success', duration: '14s' }
                    : d
            ))
            setActiveDeployment(prev => prev ? { ...prev, status: 'success' } : null)
        }, 11000) // Match log console total duration roughly
    }

    const handleManualUploadComplete = () => {
        const newDeployment: Deployment = {
            id: Date.now().toString(),
            branch: 'Archive Upload',
            commit: 'zip-upload',
            status: 'success',
            timestamp: 'Just now',
            duration: '0:45',
            type: 'manual',
        }
        setDeployments(prev => [newDeployment, ...prev])
    }

    const getStatusIcon = (status: Deployment['status']) => {
        switch (status) {
            case 'success':
                return <CheckCircle className="w-5 h-5 text-green-600" />
            case 'failed':
                return <XCircle className="w-5 h-5 text-red-600" />
            case 'running':
                return <Play className="w-5 h-5 text-blue-600 animate-pulse" />
            default:
                return <Clock className="w-5 h-5 text-yellow-600" />
        }
    }

    const getStatusBadge = (status: Deployment['status']) => {
        const variants = {
            success: 'success',
            failed: 'error',
            running: 'info',
            pending: 'warning',
        } as const
        return variants[status]
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-brand-navy">Deployment Center</h1>
                    <p className="text-gray-600 mt-1">Manage your application deployments and build settings</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200">
                <nav className="flex space-x-8">
                    <button
                        onClick={() => setActiveTab('git')}
                        className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center transition-colors ${activeTab === 'git'
                                ? 'border-brand-purple text-brand-purple'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                        disabled={showLogs}
                    >
                        <Github className="w-4 h-4 mr-2" />
                        Git Integration
                    </button>
                    <button
                        onClick={() => setActiveTab('manual')}
                        className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center transition-colors ${activeTab === 'manual'
                                ? 'border-brand-purple text-brand-purple'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                        disabled={showLogs}
                    >
                        <UploadCloud className="w-4 h-4 mr-2" />
                        Direct Upload
                    </button>
                </nav>
            </div>

            {/* Live Logs */}
            {showLogs && activeDeployment && (
                <div className="animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="flex justify-end mb-2">
                        <Button variant="ghost" size="sm" onClick={() => setShowLogs(false)}>
                            Hide Logs
                        </Button>
                    </div>
                    <LogConsole
                        status={activeDeployment.status}
                        repoName="github/repo"
                        commitHash={activeDeployment.commit}
                    />
                </div>
            )}

            {/* Tab Content */}
            {!showLogs && (
                <div>
                    {activeTab === 'git' ? (
                        <GitConfigForm onDeploy={handleDeploy} isDeploying={isDeploying} />
                    ) : (
                        <DirectUpload onUploadComplete={handleManualUploadComplete} />
                    )}
                </div>
            )}

            {/* Deployment History */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>Deployment History</CardTitle>
                        <Button variant="ghost" size="sm">
                            <Terminal className="w-4 h-4 mr-2" />
                            View Logs
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Status</TableHead>
                                <TableHead>Source</TableHead>
                                <TableHead>Commit</TableHead>
                                <TableHead>Timestamp</TableHead>
                                <TableHead>Duration</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {deployments.map((deployment) => (
                                <TableRow key={deployment.id}>
                                    <TableCell>
                                        <div className="flex items-center space-x-2">
                                            {getStatusIcon(deployment.status)}
                                            <Badge variant={getStatusBadge(deployment.status)}>
                                                {deployment.status}
                                            </Badge>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center space-x-2">
                                            {deployment.type === 'git' ? (
                                                <GitBranch className="w-4 h-4 text-gray-400" />
                                            ) : (
                                                <UploadCloud className="w-4 h-4 text-gray-400" />
                                            )}
                                            <span className="font-mono text-sm">{deployment.branch}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                                            {deployment.commit}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-sm text-gray-600">{deployment.timestamp}</span>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-sm">{deployment.duration}</span>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="sm">
                                            View Details
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
