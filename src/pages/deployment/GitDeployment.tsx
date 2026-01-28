import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { GitBranch, Terminal, Clock, CheckCircle, XCircle, Play } from 'lucide-react'

interface Deployment {
    id: string
    branch: string
    commit: string
    status: 'success' | 'failed' | 'pending' | 'running'
    timestamp: string
    duration: string
}

const mockDeployments: Deployment[] = [
    {
        id: '1',
        branch: 'main',
        commit: 'a3f2c1d',
        status: 'success',
        timestamp: '2026-01-28 14:30',
        duration: '2m 15s',
    },
    {
        id: '2',
        branch: 'develop',
        commit: 'b7e8f9a',
        status: 'failed',
        timestamp: '2026-01-28 12:15',
        duration: '1m 45s',
    },
    {
        id: '3',
        branch: 'main',
        commit: 'c9d1e2f',
        status: 'success',
        timestamp: '2026-01-27 18:20',
        duration: '2m 30s',
    },
]

export function GitDeployment() {
    const [deployments] = useState<Deployment[]>(mockDeployments)
    const [repoUrl, setRepoUrl] = useState('git@github.com:user/repo.git')

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
                    <h1 className="text-3xl font-bold text-brand-navy">Git Deployment</h1>
                    <p className="text-gray-600 mt-1">Deploy your application from Git repository</p>
                </div>
                <Button variant="primary">
                    <GitBranch className="w-4 h-4 mr-2" />
                    Deploy Now
                </Button>
            </div>

            {/* Repository Configuration */}
            <Card>
                <CardHeader>
                    <CardTitle>Repository Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <label className="text-sm font-medium mb-2 block">Repository URL</label>
                        <Input
                            value={repoUrl}
                            onChange={(e) => setRepoUrl(e.target.value)}
                            placeholder="git@github.com:username/repository.git"
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium mb-2 block">Default Branch</label>
                            <Input defaultValue="main" />
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-2 block">Build Command</label>
                            <Input defaultValue="npm run build" />
                        </div>
                    </div>
                    <Button variant="secondary">Update Settings</Button>
                </CardContent>
            </Card>

            {/* SSH Keys */}
            <Card>
                <CardHeader>
                    <CardTitle>SSH Deploy Key</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="bg-gray-50 p-4 rounded-lg font-mono text-sm overflow-x-auto">
                        <pre className="text-xs">
                            ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQC8... deploy@hostinger.com
                        </pre>
                    </div>
                    <p className="text-sm text-gray-600 mt-2">
                        Add this public key to your repository's deploy keys to enable automatic deployments.
                    </p>
                    <Button variant="secondary" className="mt-4">
                        Copy SSH Key
                    </Button>
                </CardContent>
            </Card>

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
                                <TableHead>Branch</TableHead>
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
                                            <GitBranch className="w-4 h-4 text-gray-400" />
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
