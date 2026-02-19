
import { useEffect, useState } from 'react'
import { Search, Loader2, User } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/store/authStore'
import { useToast } from '@/components/ui/toast'
import { auditLogAPI, type AuditLogEntry } from '@/lib/api/auditLog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'

type BadgeVariant = 'default' | 'success' | 'error' | 'warning' | 'info' | 'outline' | 'secondary'

export function AuditLogViewer({ projectId }: { projectId?: string | number }) {
    const { token } = useAuthStore()
    const { addToast } = useToast()
    const [logs, setLogs] = useState<AuditLogEntry[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [actionFilter, setActionFilter] = useState<string>('all')

    useEffect(() => {
        fetchLogs()
    }, [actionFilter, projectId])

    const fetchLogs = async () => {
        setIsLoading(true)
        try {
            const data = await auditLogAPI.getLogs(token!, {
                projectId,
                action: actionFilter !== 'all' ? actionFilter : undefined,
            })
            setLogs(data)
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to fetch audit logs'
            addToast({ title: 'Error', description: message, variant: 'error' })
        } finally {
            setIsLoading(false)
        }
    }

    const filteredLogs = logs.filter((log) => {
        const query = searchQuery.toLowerCase()
        return (
            log.user.email.toLowerCase().includes(query) ||
            log.description.toLowerCase().includes(query) ||
            log.action.toLowerCase().includes(query) ||
            (log.project_name ?? '').toLowerCase().includes(query)
        )
    })

    const getActionVariant = (action: string): BadgeVariant => {
        if (action.includes('login') || action.includes('logout')) return 'info'
        if (action.includes('error') || action.includes('fail') || action.includes('delete')) return 'error'
        if (action.includes('created') || action.includes('add') || action.includes('enabled')) return 'success'
        if (action.includes('update') || action.includes('change') || action.includes('restart')) return 'warning'
        return 'default'
    }

    const formatAction = (action: string) =>
        action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

    return (
        <div className="space-y-6">
            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                        placeholder="Search by user, action, or description..."
                        className="pl-10"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="w-full md:w-64">
                    <Select value={actionFilter} onValueChange={setActionFilter}>
                        <SelectTrigger>
                            <SelectValue placeholder="Filter by action" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Actions</SelectItem>
                            <SelectItem value="login">Login / Logout</SelectItem>
                            <SelectItem value="project_created">Project Created</SelectItem>
                            <SelectItem value="project_deleted">Project Deleted</SelectItem>
                            <SelectItem value="member_invited">Member Invited</SelectItem>
                            <SelectItem value="member_removed">Member Removed</SelectItem>
                            <SelectItem value="backup_created">Backup</SelectItem>
                            <SelectItem value="env_updated">Env Updated</SelectItem>
                            <SelectItem value="settings_updated">Settings Updated</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Table */}
            <div className="rounded-md border border-gray-200 bg-white overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-4">User</th>
                                <th className="px-6 py-4">Action</th>
                                <th className="px-6 py-4">Description</th>
                                <th className="px-6 py-4">IP Address</th>
                                <th className="px-6 py-4">Timestamp</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                                        <div className="flex justify-center items-center gap-2">
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Loading logs...
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredLogs.length > 0 ? (
                                filteredLogs.map((log) => (
                                    <tr key={log.id} className="hover:bg-gray-50/50">
                                        <td className="px-6 py-4 font-medium text-gray-900">
                                            <div className="flex items-center gap-2">
                                                <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                                <div>
                                                    <p className="font-medium text-gray-800 leading-tight">
                                                        {log.user.first_name || log.user.last_name
                                                            ? `${log.user.first_name} ${log.user.last_name}`.trim()
                                                            : log.user.username}
                                                    </p>
                                                    <p className="text-xs text-gray-500">{log.user.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <Badge variant={getActionVariant(log.action)}>
                                                {formatAction(log.action)}
                                            </Badge>
                                        </td>
                                        <td
                                            className="px-6 py-4 text-gray-600 max-w-xs truncate"
                                            title={log.description}
                                        >
                                            {log.description || '—'}
                                        </td>
                                        <td className="px-6 py-4 text-gray-500 font-mono text-xs">
                                            {log.ip_address || '—'}
                                        </td>
                                        <td className="px-6 py-4 text-gray-500 whitespace-nowrap text-xs">
                                            {new Date(log.timestamp).toLocaleString()}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                        No logs found matching your criteria.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
