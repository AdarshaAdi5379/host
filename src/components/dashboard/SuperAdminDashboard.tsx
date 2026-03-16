
import { useEffect, useState } from 'react'
import {
    Users, Server, Database, HardDrive,
    Activity, AlertTriangle, Shield, Terminal
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuthStore, useHasHydrated } from '@/store/authStore'
import { API_BASE_URL } from '@/lib/api/config'
import { Link } from 'react-router-dom'

interface ServerStats {
    total_users: number
    total_projects: number
    active_containers: number
    server_cpu_percent: number
    server_memory_percent: number
    server_disk_usage_gb: number
    server_disk_percent: number
    total_storage_used_gb: number
    active_malware_alerts?: number
}

export function SuperAdminDashboard() {
    const { token } = useAuthStore()
    const hydrated = useHasHydrated()
    const [stats, setStats] = useState<ServerStats | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        // Wait for the auth store to rehydrate before making API calls.
        // Without this guard, token is null on the first render and the
        // fetch returns 401, which triggers handleUnauthorized() → logout() → /login.
        if (!hydrated || !token) return
        fetchStats()
        // Poll every 30 seconds
        const interval = setInterval(fetchStats, 30000)
        return () => clearInterval(interval)
    }, [hydrated, token])

    const fetchStats = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/server_stats/`, {
                headers: { 'Authorization': `Token ${token}` }
            })
            if (response.ok) {
                const data = await response.json()
                setStats(data)
            }
        } catch (error) {
            console.error('Failed to fetch server stats:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleSystemPrune = async () => {
        if (!confirm('Are you sure you want to prune unused Docker resources? This action cannot be undone.')) return

        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/system_prune/`, {
                method: 'POST',
                headers: { 'Authorization': `Token ${token}` }
            })
            if (response.ok) {
                const data = await response.json()
                const containersReclaimed = (data.containers?.SpaceReclaimed || 0) / (1024 * 1024);
                const imagesReclaimed = (data.images?.SpaceReclaimed || 0) / (1024 * 1024);
                const volumesReclaimed = (data.volumes?.SpaceReclaimed || 0) / (1024 * 1024);
                const totalReclaimed = (containersReclaimed + imagesReclaimed + volumesReclaimed).toFixed(2);
                alert(`System prune completed successfully! Reclaimed ${totalReclaimed} MB of space.`)
                fetchStats()
            }
        } catch (error) {
            alert('Failed to prune system')
        }
    }

    const handleEmergencyStop = async () => {
        const confirmStr = prompt('Type "STOP" to confirm emergency stop of ALL containers:')
        if (confirmStr !== 'STOP') return

        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/emergency_stop/`, {
                method: 'POST',
                headers: { 'Authorization': `Token ${token}` }
            })
            if (response.ok) {
                alert('Emergency stop command sent')
                fetchStats()
            }
        } catch (error) {
            alert('Failed to execute emergency stop')
        }
    }

    if (isLoading) {
        return <div className="p-8 text-center text-gray-500">Loading system statistics...</div>
    }

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">
                        System Administration
                    </h1>
                    <p className="text-gray-500">Overview of platform resources and health</p>
                </div>
                <div className="flex gap-3">
                    <Button
                        variant="outline"
                        className="text-red-600 border-red-200 hover:bg-red-50"
                        onClick={handleEmergencyStop}
                    >
                        <AlertTriangle className="w-4 h-4 mr-2" />
                        Emergency Stop
                    </Button>
                    <Button
                        variant="outline"
                        onClick={handleSystemPrune}
                    >
                        <HardDrive className="w-4 h-4 mr-2" />
                        Prune System
                    </Button>
                </div>
            </div>

            {/* Malware Alert Banner */}
            {stats?.active_malware_alerts ? (
                <Card className="p-4 bg-red-50 border border-red-200">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-100 rounded-lg shrink-0">
                            <Shield className="w-5 h-5 text-red-600" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-medium text-red-900">
                                🚨 Malware Alert!
                            </h3>
                            <p className="text-sm text-red-700">
                                ClamAV discovered infected files and moved them to the root quarantine folder.
                                ({stats.active_malware_alerts} unresolved alert(s)). Check global audit logs immediately.
                            </p>
                        </div>
                        <Link to="/admin/audit-logs">
                            <Button size="sm" variant="outline" className="text-red-700 border-red-200 hover:bg-red-100">
                                View Logs
                            </Button>
                        </Link>
                    </div>
                </Card>
            ) : null}

            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="p-6 border-l-4 border-l-blue-500">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-gray-500">Total Users</p>
                            <h3 className="text-2xl font-bold mt-2">{stats?.total_users}</h3>
                        </div>
                        <div className="p-2 bg-blue-50 rounded-lg">
                            <Users className="w-5 h-5 text-blue-600" />
                        </div>
                    </div>
                </Card>

                <Card className="p-6 border-l-4 border-l-purple-500">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-gray-500">Active Projects</p>
                            <h3 className="text-2xl font-bold mt-2">{stats?.total_projects}</h3>
                        </div>
                        <div className="p-2 bg-purple-50 rounded-lg">
                            <Database className="w-5 h-5 text-purple-600" />
                        </div>
                    </div>
                </Card>

                <Card className="p-6 border-l-4 border-l-green-500">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-gray-500">Active Containers</p>
                            <h3 className="text-2xl font-bold mt-2">{stats?.active_containers}</h3>
                        </div>
                        <div className="p-2 bg-green-50 rounded-lg">
                            <Server className="w-5 h-5 text-green-600" />
                        </div>
                    </div>
                </Card>

                <Card className="p-6 border-l-4 border-l-orange-500">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-gray-500">Total Storage</p>
                            <h3 className="text-2xl font-bold mt-2">{stats?.total_storage_used_gb} GB</h3>
                        </div>
                        <div className="p-2 bg-orange-50 rounded-lg">
                            <HardDrive className="w-5 h-5 text-orange-600" />
                        </div>
                    </div>
                </Card>
            </div>

            {/* Server Health */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <Activity className="w-5 h-5 text-brand-purple" />
                        <h3 className="font-semibold text-lg">Server Resources</h3>
                    </div>

                    <div className="space-y-6">
                        <div>
                            <div className="flex justify-between mb-2">
                                <span className="text-sm font-medium text-gray-600">CPU Usage</span>
                                <span className="text-sm font-medium text-gray-900">{stats?.server_cpu_percent}%</span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-500 ${(stats?.server_cpu_percent || 0) > 80 ? 'bg-red-500' :
                                        (stats?.server_cpu_percent || 0) > 50 ? 'bg-orange-500' : 'bg-green-500'
                                        }`}
                                    style={{ width: `${stats?.server_cpu_percent}%` }}
                                />
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between mb-2">
                                <span className="text-sm font-medium text-gray-600">Memory Usage</span>
                                <span className="text-sm font-medium text-gray-900">{stats?.server_memory_percent}%</span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-500 ${(stats?.server_memory_percent || 0) > 80 ? 'bg-red-500' :
                                        (stats?.server_memory_percent || 0) > 50 ? 'bg-orange-500' : 'bg-blue-500'
                                        }`}
                                    style={{ width: `${stats?.server_memory_percent}%` }}
                                />
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between mb-2">
                                <span className="text-sm font-medium text-gray-600">Disk Usage (Root)</span>
                                <span className="text-sm font-medium text-gray-900">{stats?.server_disk_usage_gb} GB Used ({stats?.server_disk_percent}%)</span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-500 ${(stats?.server_disk_percent || 0) > 80 ? 'bg-red-500' :
                                        (stats?.server_disk_percent || 0) > 60 ? 'bg-orange-500' : 'bg-gray-500'
                                        }`}
                                    style={{ width: `${stats?.server_disk_percent || 0}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </Card>

                <Card className="p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <Shield className="w-5 h-5 text-brand-purple" />
                        <h3 className="font-semibold text-lg">Admin Actions</h3>
                    </div>

                    <div className="space-y-4">
                        <div className="p-4 bg-gray-50 rounded-lg flex items-center justify-between">
                            <div>
                                <h4 className="font-medium">User Management</h4>
                                <p className="text-sm text-gray-500">View and manage all registered users</p>
                            </div>
                            <Button variant="outline" size="sm">Manage Users</Button>
                        </div>

                        <div className="p-4 bg-gray-50 rounded-lg flex items-center justify-between">
                            <div>
                                <h4 className="font-medium">Global Audit Log</h4>
                                <p className="text-sm text-gray-500">View all system activities</p>
                            </div>
                            <Link to="/admin/audit-logs">
                                <Button variant="outline" size="sm">View Logs</Button>
                            </Link>
                        </div>

                        <div className="p-4 bg-gray-50 rounded-lg flex items-center justify-between">
                            <div>
                                <h4 className="font-medium">Terminal Access</h4>
                                <p className="text-sm text-gray-500">Direct shell access to host</p>
                            </div>
                            <Button variant="outline" size="sm" disabled>
                                <Terminal className="w-3 h-3 mr-2" />
                                Console
                            </Button>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    )
}
