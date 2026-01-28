import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, TrendingDown, Zap, Clock } from 'lucide-react'

interface PerformanceMetric {
    label: string
    value: string
    trend?: 'up' | 'down'
    trendValue?: string
    status: 'excellent' | 'good' | 'warning' | 'critical'
}

export function PerformanceSnapshot() {
    const metrics: PerformanceMetric[] = [
        {
            label: 'Uptime',
            value: '99.98%',
            trend: 'up',
            trendValue: '+0.02%',
            status: 'excellent',
        },
        {
            label: 'Speed Index',
            value: '1.2s',
            trend: 'down',
            trendValue: '-0.3s',
            status: 'good',
        },
        {
            label: 'PHP Version',
            value: '8.2',
            status: 'good',
        },
    ]

    const getStatusColor = (status: PerformanceMetric['status']) => {
        const colors = {
            excellent: 'bg-green-100 text-green-800',
            good: 'bg-blue-100 text-blue-800',
            warning: 'bg-yellow-100 text-yellow-800',
            critical: 'bg-red-100 text-red-800',
        }
        return colors[status]
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                    <Zap className="w-5 h-5 text-brand-purple" />
                    <span>Performance Snapshot</span>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {metrics.map((metric) => (
                        <div
                            key={metric.label}
                            className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm text-gray-600">{metric.label}</span>
                                <Badge className={getStatusColor(metric.status)}>
                                    {metric.status}
                                </Badge>
                            </div>
                            <div className="flex items-end justify-between">
                                <span className="text-2xl font-bold">{metric.value}</span>
                                {metric.trend && (
                                    <div className="flex items-center space-x-1">
                                        {metric.trend === 'up' ? (
                                            <TrendingUp className="w-4 h-4 text-green-600" />
                                        ) : (
                                            <TrendingDown className="w-4 h-4 text-green-600" />
                                        )}
                                        <span className="text-xs text-green-600">
                                            {metric.trendValue}
                                        </span>
                                    </div>
                                )}
                            </div>
                            {metric.label === 'PHP Version' && (
                                <button className="mt-2 text-xs text-brand-purple hover:underline">
                                    Upgrade to 8.3 →
                                </button>
                            )}
                        </div>
                    ))}
                </div>
                <div className="mt-4 flex items-center space-x-2 text-sm text-gray-600">
                    <Clock className="w-4 h-4" />
                    <span>Last updated: 2 minutes ago</span>
                </div>
            </CardContent>
        </Card>
    )
}
