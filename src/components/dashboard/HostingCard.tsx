import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Server, Calendar, HardDrive } from 'lucide-react'
import type { Service } from '@/data/mockData'
import { formatBytes, getDaysUntil, getPercentage } from '@/lib/utils'

interface HostingCardProps {
    service: Service
}

export function HostingCard({ service }: HostingCardProps) {
    const daysUntilRenewal = service.renewalDate ? getDaysUntil(service.renewalDate) : 0
    const diskPercentage = service.diskUsed && service.diskTotal
        ? getPercentage(service.diskUsed, service.diskTotal)
        : 0

    const statusColors = {
        active: 'success',
        pending: 'warning',
        suspended: 'error',
        expired: 'error',
    } as const

    return (
        <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
                <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-brand-purple/10 rounded-lg flex items-center justify-center">
                            <Server className="w-6 h-6 text-brand-purple" />
                        </div>
                        <div>
                            <CardTitle className="text-lg">{service.name}</CardTitle>
                            <p className="text-sm text-gray-600 mt-1">{service.plan}</p>
                        </div>
                    </div>
                    <Badge variant={statusColors[service.status]}>
                        {service.status.charAt(0).toUpperCase() + service.status.slice(1)}
                    </Badge>
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                {/* Disk Usage */}
                {service.diskUsed !== undefined && service.diskTotal !== undefined && (
                    <div>
                        <div className="flex items-center justify-between text-sm mb-2">
                            <div className="flex items-center space-x-2">
                                <HardDrive className="w-4 h-4 text-gray-500" />
                                <span className="text-gray-600">Disk Usage</span>
                            </div>
                            <span className="font-semibold">
                                {formatBytes(service.diskUsed)} / {formatBytes(service.diskTotal)}
                            </span>
                        </div>
                        <Progress
                            value={diskPercentage}
                            variant={diskPercentage > 80 ? 'danger' : diskPercentage > 60 ? 'warning' : 'primary'}
                        />
                        <p className="text-xs text-gray-500 mt-1">{diskPercentage}% used</p>
                    </div>
                )}

                {/* Renewal Date */}
                {service.renewalDate && (
                    <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center space-x-2">
                            <Calendar className="w-4 h-4 text-gray-500" />
                            <span className="text-gray-600">Renewal</span>
                        </div>
                        <span className="font-semibold">
                            {daysUntilRenewal > 0 ? `${daysUntilRenewal} days` : 'Expired'}
                        </span>
                    </div>
                )}

                {/* Action Button */}
                <Button variant="primary" className="w-full">
                    Manage Hosting
                </Button>
            </CardContent>
        </Card>
    )
}
