import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import { Calendar, TrendingUp } from 'lucide-react'

interface UpcomingCharge {
    id: string
    serviceName: string
    amount: number
    currency: 'USD' | 'INR' | 'EUR'
    dueDate: string
    daysUntilDue: number
}

export function UpcomingCharges() {
    // Only show real data from database
    const charges: UpcomingCharge[] = []

    // Don't render anything if no charges
    if (charges.length === 0) return null

    const totalAmount = charges.reduce((sum, charge) => sum + charge.amount, 0)
    const currency = charges[0]?.currency || 'USD'

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                    <TrendingUp className="w-5 h-5 text-brand-purple" />
                    <span>Upcoming Charges (Next 30 Days)</span>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Total Amount */}
                <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Total Amount Due</p>
                    <p className="text-3xl font-bold text-brand-purple">
                        {formatCurrency(totalAmount, currency)}
                    </p>
                </div>

                {/* Charge List */}
                <div className="space-y-3">
                    {charges.map((charge) => (
                        <div
                            key={charge.id}
                            className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                        >
                            <div className="flex-1">
                                <h4 className="font-medium text-sm mb-1">{charge.serviceName}</h4>
                                <div className="flex items-center space-x-2 text-xs text-gray-600">
                                    <Calendar className="w-3 h-3" />
                                    <span>Due {charge.dueDate}</span>
                                    <Badge variant={charge.daysUntilDue <= 7 ? 'warning' : 'default'}>
                                        {charge.daysUntilDue} days
                                    </Badge>
                                </div>
                            </div>
                            <span className="font-semibold">
                                {formatCurrency(charge.amount, charge.currency)}
                            </span>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}
