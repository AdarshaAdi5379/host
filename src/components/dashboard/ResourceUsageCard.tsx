import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Cpu, HardDrive, Activity, Wifi } from 'lucide-react'
import type { ResourceUsage } from '@/data/mockData'

interface ResourceUsageProps {
    usage: ResourceUsage
}

export function ResourceUsageCard({ usage }: ResourceUsageProps) {
    const resources = [
        {
            name: 'CPU Usage',
            value: usage.cpu,
            icon: Cpu,
            color: usage.cpu > 80 ? 'danger' : usage.cpu > 60 ? 'warning' : 'primary',
        },
        {
            name: 'RAM Usage',
            value: usage.ram,
            icon: Activity,
            color: usage.ram > 80 ? 'danger' : usage.ram > 60 ? 'warning' : 'primary',
        },
        {
            name: 'Disk Usage',
            value: usage.disk,
            icon: HardDrive,
            color: usage.disk > 80 ? 'danger' : usage.disk > 60 ? 'warning' : 'primary',
        },
        {
            name: 'Bandwidth',
            value: usage.bandwidth,
            icon: Wifi,
            color: usage.bandwidth > 80 ? 'danger' : usage.bandwidth > 60 ? 'warning' : 'success',
        },
    ] as const

    return (
        <Card>
            <CardHeader>
                <CardTitle>Resource Usage</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {resources.map((resource) => {
                    const Icon = resource.icon
                    return (
                        <div key={resource.name}>
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center space-x-2">
                                    <Icon className="w-4 h-4 text-gray-500" />
                                    <span className="text-sm font-medium">{resource.name}</span>
                                </div>
                                <span className="text-sm font-bold">{resource.value}%</span>
                            </div>
                            <Progress value={resource.value} variant={resource.color} />
                        </div>
                    )
                })}
            </CardContent>
        </Card>
    )
}
