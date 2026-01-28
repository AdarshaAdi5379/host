import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CreditCard, Trash2, Star } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import type { PaymentMethod } from '@/store/billingStore'

interface PaymentMethodCardProps {
    method: PaymentMethod
    onSetPrimary: (id: string) => void
    onDelete: (id: string) => void
}

export function PaymentMethodCard({
    method,
    onSetPrimary,
    onDelete,
}: PaymentMethodCardProps) {
    const { addToast } = useToast()

    const handleSetPrimary = () => {
        onSetPrimary(method.id)
        addToast({
            title: 'Primary Method Updated',
            description: 'This payment method is now your primary',
            variant: 'success',
        })
    }

    const handleDelete = () => {
        onDelete(method.id)
        addToast({
            title: 'Payment Method Removed',
            description: 'The payment method has been deleted',
            variant: 'success',
        })
    }

    const getCardIcon = () => {
        return <CreditCard className="w-6 h-6 text-gray-600" />
    }

    const isExpiringSoon = () => {
        if (!method.expiryMonth || !method.expiryYear) return false
        const now = new Date()
        const expiryDate = new Date(method.expiryYear, method.expiryMonth - 1)
        const daysUntilExpiry = Math.floor(
            (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        )
        return daysUntilExpiry <= 30 && daysUntilExpiry >= 0
    }

    return (
        <Card className={method.isPrimary ? 'border-brand-purple border-2' : ''}>
            <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4">
                        <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                            {getCardIcon()}
                        </div>
                        <div>
                            <div className="flex items-center space-x-2 mb-1">
                                <h4 className="font-semibold">
                                    {method.type === 'card' && method.brand
                                        ? method.brand
                                        : method.type.toUpperCase()}
                                </h4>
                                {method.isPrimary && (
                                    <Badge variant="success" className="flex items-center space-x-1">
                                        <Star className="w-3 h-3 fill-current" />
                                        <span>Primary</span>
                                    </Badge>
                                )}
                            </div>
                            {method.type === 'card' && method.last4 && (
                                <p className="text-sm text-gray-600 font-mono">
                                    **** **** **** {method.last4}
                                </p>
                            )}
                            {method.holderName && (
                                <p className="text-xs text-gray-500 mt-1">{method.holderName}</p>
                            )}
                            {method.expiryMonth && method.expiryYear && (
                                <div className="mt-2">
                                    <span className="text-xs text-gray-500">
                                        Expires {method.expiryMonth.toString().padStart(2, '0')}/
                                        {method.expiryYear}
                                    </span>
                                    {isExpiringSoon() && (
                                        <Badge variant="warning" className="ml-2 text-xs">
                                            Expiring Soon
                                        </Badge>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center space-x-2">
                        {!method.isPrimary && (
                            <Button variant="ghost" size="sm" onClick={handleSetPrimary}>
                                Set Primary
                            </Button>
                        )}
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleDelete}
                            disabled={method.isPrimary}
                        >
                            <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
