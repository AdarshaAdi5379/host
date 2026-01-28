import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Mail, Users, Database } from 'lucide-react'
import type { Service } from '@/data/mockData'
import { formatBytes, getPercentage } from '@/lib/utils'

interface EmailCardProps {
    service: Service
}

export function EmailCard({ service }: EmailCardProps) {
    const storagePercentage = service.storageUsed && service.storageTotal
        ? getPercentage(service.storageUsed, service.storageTotal)
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
                        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Mail className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                            <CardTitle className="text-lg">{service.name}</CardTitle>
                            <p className="text-sm text-gray-600 mt-1">Email Service</p>
                        </div>
                    </div>
                    <Badge variant={statusColors[service.status]}>
                        {service.status.charAt(0).toUpperCase() + service.status.slice(1)}
                    </Badge>
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                {/* Mailbox Count */}
                {service.mailboxCount !== undefined && (
                    <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center space-x-2">
                            <Users className="w-4 h-4 text-gray-500" />
                            <span className="text-gray-600">Mailboxes</span>
                        </div>
                        <span className="font-semibold">{service.mailboxCount}</span>
                    </div>
                )}

                {/* Storage Usage */}
                {service.storageUsed !== undefined && service.storageTotal !== undefined && (
                    <div>
                        <div className="flex items-center justify-between text-sm mb-2">
                            <div className="flex items-center space-x-2">
                                <Database className="w-4 h-4 text-gray-500" />
                                <span className="text-gray-600">Storage</span>
                            </div>
                            <span className="font-semibold">
                                {formatBytes(service.storageUsed)} / {formatBytes(service.storageTotal)}
                            </span>
                        </div>
                        <Progress
                            value={storagePercentage}
                            variant={storagePercentage > 80 ? 'danger' : storagePercentage > 60 ? 'warning' : 'primary'}
                        />
                        <p className="text-xs text-gray-500 mt-1">{storagePercentage}% used</p>
                    </div>
                )}

                {/* Action Button */}
                <Button variant="primary" className="w-full">
                    Manage Email
                </Button>
            </CardContent>
        </Card>
    )
}
