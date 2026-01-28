import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Globe, Calendar, MapPin } from 'lucide-react'
import type { Service } from '@/data/mockData'
import { getDaysUntil } from '@/lib/utils'

interface DomainCardProps {
    service: Service
}

export function DomainCard({ service }: DomainCardProps) {
    const daysUntilRenewal = service.renewalDate ? getDaysUntil(service.renewalDate) : 0

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
                        <div className="w-12 h-12 bg-success/10 rounded-lg flex items-center justify-center">
                            <Globe className="w-6 h-6 text-success" />
                        </div>
                        <div>
                            <CardTitle className="text-lg">{service.name}</CardTitle>
                            <p className="text-sm text-gray-600 mt-1">Domain Registration</p>
                        </div>
                    </div>
                    <Badge variant={statusColors[service.status]}>
                        {service.status.charAt(0).toUpperCase() + service.status.slice(1)}
                    </Badge>
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                {/* Points To */}
                {service.pointsTo && (
                    <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center space-x-2">
                            <MapPin className="w-4 h-4 text-gray-500" />
                            <span className="text-gray-600">Points to</span>
                        </div>
                        <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                            {service.pointsTo}
                        </span>
                    </div>
                )}

                {/* Renewal Date */}
                {service.renewalDate && (
                    <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center space-x-2">
                            <Calendar className="w-4 h-4 text-gray-500" />
                            <span className="text-gray-600">Expires in</span>
                        </div>
                        <span className={`font-semibold ${daysUntilRenewal < 30 ? 'text-red-600' : ''}`}>
                            {daysUntilRenewal > 0 ? `${daysUntilRenewal} days` : 'Expired'}
                        </span>
                    </div>
                )}

                {/* Action Button */}
                <Button variant="primary" className="w-full">
                    Manage Domain
                </Button>
            </CardContent>
        </Card>
    )
}
