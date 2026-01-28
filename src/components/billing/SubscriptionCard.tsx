import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Calendar, RotateCw } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { formatCurrency } from '@/lib/utils'

interface Subscription {
    id: string
    serviceName: string
    serviceType: 'hosting' | 'domain' | 'ssl' | 'email'
    plan: string
    price: number
    currency: 'USD' | 'INR' | 'EUR'
    renewalDate: string
    daysUntilRenewal: number
    autoRenew: boolean
    status: 'active' | 'expired' | 'suspended' | 'grace'
}

interface SubscriptionCardProps {
    subscription: Subscription
    onToggleAutoRenew: (id: string) => void
    onRenewNow: (id: string) => void
}

export function SubscriptionCard({
    subscription,
    onToggleAutoRenew,
    onRenewNow,
}: SubscriptionCardProps) {
    const { addToast } = useToast()

    const getStatusVariant = (status: Subscription['status']) => {
        const variants = {
            active: 'success',
            expired: 'error',
            suspended: 'error',
            grace: 'warning',
        } as const
        return variants[status]
    }

    const getStatusLabel = (status: Subscription['status']) => {
        const labels = {
            active: 'Active',
            expired: 'Expired',
            suspended: 'Suspended',
            grace: 'Grace Period',
        }
        return labels[status]
    }

    const getRenewalColor = (days: number) => {
        if (days <= 7) return 'text-red-600 font-semibold'
        if (days <= 30) return 'text-yellow-600 font-medium'
        return 'text-gray-600'
    }

    const handleToggle = () => {
        onToggleAutoRenew(subscription.id)
        addToast({
            title: 'Auto-Renew Updated',
            description: `Auto-renew for ${subscription.serviceName} has been ${subscription.autoRenew ? 'disabled' : 'enabled'
                }`,
            variant: 'success',
        })
    }

    const handleRenew = () => {
        onRenewNow(subscription.id)
        addToast({
            title: 'Renewal Initiated',
            description: `Processing renewal for ${subscription.serviceName}`,
            variant: 'success',
        })
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-start justify-between">
                    <div>
                        <CardTitle className="text-lg">{subscription.serviceName}</CardTitle>
                        <p className="text-sm text-gray-600 mt-1">{subscription.plan}</p>
                    </div>
                    <Badge variant={getStatusVariant(subscription.status)}>
                        {getStatusLabel(subscription.status)}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Pricing */}
                <div className="flex items-baseline space-x-2">
                    <span className="text-2xl font-bold">
                        {formatCurrency(subscription.price, subscription.currency)}
                    </span>
                    <span className="text-sm text-gray-500">/year</span>
                </div>

                {/* Renewal Date */}
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span className="text-sm">Renews on {subscription.renewalDate}</span>
                    </div>
                    <span className={`text-sm ${getRenewalColor(subscription.daysUntilRenewal)}`}>
                        {subscription.daysUntilRenewal} days
                    </span>
                </div>

                {/* Auto-Renew Toggle */}
                <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <div>
                        <h4 className="font-medium text-sm">Auto-Renew</h4>
                        <p className="text-xs text-gray-600">
                            {subscription.autoRenew
                                ? 'Service will renew automatically'
                                : 'Manual renewal required'}
                        </p>
                    </div>
                    <button
                        onClick={handleToggle}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${subscription.autoRenew ? 'bg-brand-purple' : 'bg-gray-300'
                            }`}
                    >
                        <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${subscription.autoRenew ? 'translate-x-6' : 'translate-x-1'
                                }`}
                        />
                    </button>
                </div>

                {/* Renew Now Button */}
                {subscription.status !== 'active' && (
                    <Button variant="primary" className="w-full" onClick={handleRenew}>
                        <RotateCw className="w-4 h-4 mr-2" />
                        Renew Now
                    </Button>
                )}
            </CardContent>
        </Card>
    )
}
