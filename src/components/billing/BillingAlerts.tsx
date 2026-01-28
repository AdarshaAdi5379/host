import { AlertTriangle, XCircle, CreditCard } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface Alert {
    id: string
    type: 'unpaid' | 'failed' | 'expiring'
    title: string
    description: string
    action?: {
        label: string
        onClick: () => void
    }
}

const mockAlerts: Alert[] = [
    {
        id: '1',
        type: 'failed',
        title: 'Payment Failed',
        description: 'Your recent payment of $99.99 was declined. Please update your payment method.',
        action: {
            label: 'Update Payment',
            onClick: () => console.log('Navigate to payment methods'),
        },
    },
    {
        id: '2',
        type: 'expiring',
        title: 'Card Expiring Soon',
        description: 'Your primary card ending in 1234 expires in 15 days.',
        action: {
            label: 'Update Card',
            onClick: () => console.log('Navigate to payment methods'),
        },
    },
]

export function BillingAlerts() {
    if (mockAlerts.length === 0) return null

    const getAlertStyles = (type: Alert['type']) => {
        const styles = {
            unpaid: {
                bg: 'bg-yellow-50',
                border: 'border-yellow-200',
                icon: <AlertTriangle className="w-5 h-5 text-yellow-600" />,
                badge: 'warning' as const,
            },
            failed: {
                bg: 'bg-red-50',
                border: 'border-red-200',
                icon: <XCircle className="w-5 h-5 text-red-600" />,
                badge: 'error' as const,
            },
            expiring: {
                bg: 'bg-orange-50',
                border: 'border-orange-200',
                icon: <CreditCard className="w-5 h-5 text-orange-600" />,
                badge: 'warning' as const,
            },
        }
        return styles[type]
    }

    return (
        <div className="space-y-3">
            {mockAlerts.map((alert) => {
                const styles = getAlertStyles(alert.type)
                return (
                    <div
                        key={alert.id}
                        className={`p-4 border rounded-lg ${styles.bg} ${styles.border}`}
                    >
                        <div className="flex items-start space-x-3">
                            {styles.icon}
                            <div className="flex-1">
                                <div className="flex items-center space-x-2 mb-1">
                                    <h4 className="font-semibold">{alert.title}</h4>
                                    <Badge variant={styles.badge}>{alert.type}</Badge>
                                </div>
                                <p className="text-sm text-gray-700">{alert.description}</p>
                                {alert.action && (
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        className="mt-3"
                                        onClick={alert.action.onClick}
                                    >
                                        {alert.action.label}
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
