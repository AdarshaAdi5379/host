
import { useEffect, useRef, useState } from 'react'
import { Loader2, Cpu, HardDrive } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { API_BASE_URL } from '@/lib/api/config'

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

// After this many consecutive failures, slow down polling to avoid console spam
const BACKOFF_THRESHOLD = 3
const NORMAL_INTERVAL_MS = 3000
const BACKOFF_INTERVAL_MS = 15000

export function ResourceMonitor({ siteId, isRunning }: ResourceMonitorProps) {
    const [stats, setStats] = useState<ResourceStats | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(false)
    const token = useAuthStore(state => state.token)
    const consecutiveFailures = useRef(0)

    useEffect(() => {
        if (!isRunning) {
            setStats(null)
            setLoading(false)
            return
        }

        let timeoutId: ReturnType<typeof setTimeout>
        let cancelled = false
        const abortControllerRef = { current: new AbortController() }

        const fetchStats = async () => {
            if (cancelled) return

            abortControllerRef.current = new AbortController()
            const timeoutHandle = setTimeout(() => abortControllerRef.current.abort(), 5000)

            try {
                const response = await fetch(`${API_BASE_URL}/api/sites/${siteId}/stats/`, {
                    signal: abortControllerRef.current.signal,
                    headers: {
                        ...(token ? { 'Authorization': `Token ${token}` } : {}),
                    },
                })
                if (cancelled) return

                clearTimeout(timeoutHandle)

                if (response.ok) {
                    const data = await response.json()
                    setStats(data)
                    setError(false)
                    consecutiveFailures.current = 0
                } else {
                    consecutiveFailures.current++
                    setError(true)
                }
            } catch (err: any) {
                clearTimeout(timeoutHandle)
                if (cancelled) return

                consecutiveFailures.current++

                // Only log if it's not a transient network blip (aborts, network changes)
                const isAbort = err?.name === 'AbortError'
                const isTransient =
                    isAbort ||
                    (err instanceof TypeError &&
                        (err.message.includes('Failed to fetch') ||
                            err.message.includes('NetworkError')))

                if (!isTransient || consecutiveFailures.current <= 1) {
                    console.warn(`[ResourceMonitor] site=${siteId} fetch failed (attempt ${consecutiveFailures.current}):`, err)
                }

                setError(true)
            } finally {
                if (!cancelled) {
                    setLoading(false)
                    // Back off polling interval when errors accumulate
                    const interval =
                        consecutiveFailures.current >= BACKOFF_THRESHOLD
                            ? BACKOFF_INTERVAL_MS
                            : NORMAL_INTERVAL_MS
                    timeoutId = setTimeout(fetchStats, interval)
                }
            }
        }

        setLoading(true)
        fetchStats()

        return () => {
            cancelled = true
            clearTimeout(timeoutId)
            abortControllerRef.current.abort()
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

    if (error && !stats) {
        return (
            <div className="text-xs text-amber-500 p-2">
                Telemetry temporarily unavailable
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
