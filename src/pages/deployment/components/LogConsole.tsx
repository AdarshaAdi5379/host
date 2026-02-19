import { useEffect, useState, useRef } from 'react'
import { Terminal, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface LogConsoleProps {
    status: 'pending' | 'running' | 'success' | 'failed'
    repoName: string
    commitHash: string
}

interface LogEntry {
    id: string
    timestamp: string
    message: string
    type: 'info' | 'success' | 'error' | 'warning'
}

export function LogConsole({ status, repoName, commitHash }: LogConsoleProps) {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const scrollRef = useRef<HTMLDivElement>(null)

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [logs])

    // Simulate log streaming
    useEffect(() => {
        if (status !== 'running') return

        const steps = [
            { msg: `Initializing build environment for ${repoName}...`, type: 'info' as const, delay: 500 },
            { msg: `Cloning repository (${commitHash})...`, type: 'info' as const, delay: 1500 },
            { msg: 'Checking out branch main...', type: 'info' as const, delay: 2500 },
            { msg: 'Installing dependencies using npm...', type: 'info' as const, delay: 3500 },
            { msg: 'Running build command: npm run build...', type: 'info' as const, delay: 5500 },
            { msg: 'Build optimization complete.', type: 'info' as const, delay: 7500 },
            { msg: 'Deploying to edge network...', type: 'info' as const, delay: 8500 },
            { msg: 'Verifying deployment health...', type: 'info' as const, delay: 9500 },
            { msg: 'Deployment successful!', type: 'success' as const, delay: 10500 },
        ]

        let timeouts: ReturnType<typeof setTimeout>[] = []

        setLogs([]) // Clear previous logs

        steps.forEach((step) => {
            const timeout = setTimeout(() => {
                setLogs((prev) => [
                    ...prev,
                    {
                        id: Date.now().toString() + Math.random(),
                        timestamp: new Date().toLocaleTimeString(),
                        message: step.msg,
                        type: step.type,
                    },
                ])
            }, step.delay)
            timeouts.push(timeout)
        })

        return () => {
            timeouts.forEach(clearTimeout)
        }
    }, [status, repoName, commitHash])

    const getStatusBadge = () => {
        switch (status) {
            case 'running':
                return <Badge variant="info">Building</Badge>
            case 'success':
                return <Badge variant="success">Deployed</Badge>
            case 'failed':
                return <Badge variant="error">Failed</Badge>
            default:
                return <Badge variant="default">Queued</Badge>
        }
    }

    return (
        <Card className="bg-slate-950 border-slate-800 text-slate-200">
            <CardHeader className="border-b border-slate-800 pb-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <Terminal className="w-5 h-5 text-slate-400" />
                        <CardTitle className="text-slate-100">Build Logs</CardTitle>
                    </div>
                    <div className="flex items-center space-x-3">
                        {status === 'running' && <Loader2 className="w-4 h-4 animate-spin text-blue-400" />}
                        {getStatusBadge()}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div
                    ref={scrollRef}
                    className="h-80 overflow-y-auto p-4 font-mono text-sm space-y-2"
                >
                    {logs.length === 0 && status === 'pending' && (
                        <div className="text-slate-500 italic">Waiting for build agent...</div>
                    )}

                    {logs.map((log) => (
                        <div key={log.id} className="flex space-x-3">
                            <span className="text-slate-500 shrink-0 select-none">{log.timestamp}</span>
                            <span className={`break-all ${log.type === 'error' ? 'text-red-400' :
                                log.type === 'success' ? 'text-green-400' :
                                    log.type === 'warning' ? 'text-yellow-400' :
                                        'text-slate-300'
                                }`}>
                                {log.type === 'success' && '✓ '}
                                {log.type === 'error' && '✕ '}
                                {log.message}
                            </span>
                        </div>
                    ))}

                    {status === 'success' && logs.length > 0 && (
                        <div className="pt-2 text-green-400 font-bold">
                            Done in {((logs.length * 1.5)).toFixed(2)}s.
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
