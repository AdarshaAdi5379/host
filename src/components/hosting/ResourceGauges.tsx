import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { HardDrive, FileText, Cpu } from 'lucide-react'

interface ResourceGauge {
    label: string
    used: number
    total: number
    unit: string
    icon: React.ElementType
    warningThreshold: number
}

export function ResourceGauges() {
    const resources: ResourceGauge[] = [
        {
            label: 'Disk Usage',
            used: 2.5,
            total: 10,
            unit: 'GB',
            icon: HardDrive,
            warningThreshold: 80,
        },
        {
            label: 'Inodes',
            used: 45230,
            total: 100000,
            unit: '',
            icon: FileText,
            warningThreshold: 80,
        },
        {
            label: 'RAM Usage',
            used: 512,
            total: 1024,
            unit: 'MB',
            icon: Cpu,
            warningThreshold: 75,
        },
    ]

    const getPercentage = (used: number, total: number) => {
        return Math.round((used / total) * 100)
    }

    const getVariant = (percentage: number, threshold: number) => {
        if (percentage >= threshold) return 'danger'
        if (percentage >= threshold - 20) return 'warning'
        return 'primary'
    }

    const formatValue = (value: number, unit: string) => {
        if (unit === '') {
            return value.toLocaleString()
        }
        return `${value.toFixed(1)} ${unit}`
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Resource Usage</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {resources.map((resource) => {
                    const Icon = resource.icon
                    const percentage = getPercentage(resource.used, resource.total)
                    const variant = getVariant(percentage, resource.warningThreshold)

                    return (
                        <div key={resource.label}>
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center space-x-2">
                                    <Icon className="w-4 h-4 text-gray-500" />
                                    <span className="text-sm font-medium">{resource.label}</span>
                                </div>
                                <span className="text-sm font-semibold">
                                    {formatValue(resource.used, resource.unit)} /{' '}
                                    {formatValue(resource.total, resource.unit)}
                                </span>
                            </div>
                            <Progress value={percentage} variant={variant} />
                            <div className="flex items-center justify-between mt-1">
                                <span className="text-xs text-gray-500">{percentage}% used</span>
                                {percentage >= resource.warningThreshold && (
                                    <span className="text-xs text-red-600 font-medium">
                                        Approaching limit
                                    </span>
                                )}
                            </div>
                        </div>
                    )
                })}
            </CardContent>
        </Card>
    )
}
