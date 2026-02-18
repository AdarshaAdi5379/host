
import { useEffect, useState } from 'react'
import { Loader2, Cpu, HardDrive } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'

interface ResourceStats {
    cpu_percent: number
    memory_usage_mb: number
    memory_limit_mb: number
    memory_percent: number
    status: 'online' | 'offline'
}

interface ResourceMonitorProps {
    siteId: number
    isRunning: boolean
}

export function ResourceMonitor({ siteId, isRunning }: ResourceMonitorProps) {
    const [stats, setStats] = useState<ResourceStats | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(false)
    const token = useAuthStore(state => state.token)

    useEffect(() => {
        let intervalId: ReturnType<typeof setInterval>

        const fetchStats = async () => {
            if (!isRunning) {
                setStats(null)
                setLoading(false)
                return
            }

            try {
                const response = await fetch(`http://localhost:8000/api/sites/${siteId}/stats/`, {
                    headers: {
                        ...(token ? { 'Authorization': `Token ${token}` } : {}),
                    },
                })
                if (response.ok) {
                    const data = await response.json()
                    setStats(data)
                    setError(false)
                } else {
                    setError(true)
                }
            } catch (err) {
                console.error('Failed to fetch stats:', err)
                setError(true)
            } finally {
                setLoading(false)
            }
        }

        // Initial fetch
        fetchStats()

        // Poll every 3 seconds if running
        if (isRunning) {
            intervalId = setInterval(fetchStats, 3000)
        }

        return () => {
            if (intervalId) clearInterval(intervalId)
        }
    }, [siteId, isRunning, token])

    if (!isRunning) {
        return (
            <div className="bg-gray-50 rounded-lg p-4 text-center text-sm text-gray-500 border border-dashed border-gray-200">
                Start the site to view resource usage
            </div>
        )
    }

    if (loading && !stats) {
        return (
            <div className="flex items-center justify-center p-4">
                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                <span className="ml-2 text-xs text-gray-400">Loading telemetry...</span>
            </div>
        )
    }

    if (error) {
        return (
            <div className="text-xs text-red-500 p-2">
                Failed to load telemetry
            </div>
        )
    }

    if (!stats || stats.status === 'offline') {
        return (
            <div className="bg-gray-50 rounded-lg p-4 text-center text-sm text-gray-500 border border-dashed border-gray-200">
                Telemetry unavailable (Offline)
            </div>
        )
    }

    const getUsageColor = (percent: number) => {
        if (percent < 50) return 'bg-green-500'
        if (percent < 80) return 'bg-yellow-500'
        return 'bg-red-500'
    }

    return (
        <div className="space-y-3 bg-slate-50 p-3 rounded-lg border border-slate-100">
            {/* CPU Usage */}
            <div>
                <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center text-xs font-medium text-gray-600">
                        <Cpu className="w-3 h-3 mr-1" />
                        CPU
                    </div>
                    <span className="text-xs font-mono text-gray-700">{stats.cpu_percent}%</span>
                </div>
                <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                    <div
                        className={`h-full transition-all duration-500 ${getUsageColor(stats.cpu_percent)}`}
                        style={{ width: `${Math.min(stats.cpu_percent, 100)}%` }}
                    />
                </div>
            </div>

            {/* Memory Usage */}
            <div>
                <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center text-xs font-medium text-gray-600">
                        <HardDrive className="w-3 h-3 mr-1" />
                        RAM
                    </div>
                    <span className="text-xs font-mono text-gray-700">
                        {Math.round(stats.memory_usage_mb)}MB / {Math.round(stats.memory_limit_mb)}MB
                    </span>
                </div>
                <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                    <div
                        className={`h-full transition-all duration-500 ${getUsageColor(stats.memory_percent)}`}
                        style={{ width: `${Math.min(stats.memory_percent, 100)}%` }}
                    />
                </div>
            </div>
        </div>
    )
}
