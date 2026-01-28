import { useState } from 'react'
import { SubscriptionCard } from '@/components/billing/SubscriptionCard'
import { PaymentMethodCard } from '@/components/billing/PaymentMethodCard'
import { UpcomingCharges } from '@/components/billing/UpcomingCharges'
import { BillingAlerts } from '@/components/billing/BillingAlerts'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import type { PaymentMethod } from '@/store/billingStore'

type Tab = 'subscriptions' | 'payment-methods' | 'invoices'

// Mock data
const mockSubscriptions = [
    {
        id: '1',
        serviceName: 'Premium Hosting',
        serviceType: 'hosting' as const,
        plan: 'Business Plan',
        price: 99.99,
        currency: 'USD' as const,
        renewalDate: '2026-02-15',
        daysUntilRenewal: 18,
        autoRenew: true,
        status: 'active' as const,
    },
    {
        id: '2',
        serviceName: 'example.com',
        serviceType: 'domain' as const,
        plan: 'Domain Registration',
        price: 14.99,
        currency: 'USD' as const,
        renewalDate: '2026-02-20',
        daysUntilRenewal: 23,
        autoRenew: false,
        status: 'active' as const,
    },
]

const mockPaymentMethods: PaymentMethod[] = [
    {
        id: '1',
        type: 'card',
        last4: '1234',
        brand: 'Visa',
        expiryMonth: 12,
        expiryYear: 2026,
        isPrimary: true,
        holderName: 'John Doe',
    },
    {
        id: '2',
        type: 'card',
        last4: '5678',
        brand: 'Mastercard',
        expiryMonth: 3,
        expiryYear: 2025,
        isPrimary: false,
        holderName: 'John Doe',
    },
]

export function BillingManagement() {
    const [activeTab, setActiveTab] = useState<Tab>('subscriptions')
    const [subscriptions, setSubscriptions] = useState(mockSubscriptions)
    const [paymentMethods, setPaymentMethods] = useState(mockPaymentMethods)

    const tabs: { id: Tab; label: string }[] = [
        { id: 'subscriptions', label: 'Subscriptions' },
        { id: 'payment-methods', label: 'Payment Methods' },
        { id: 'invoices', label: 'Invoices' },
    ]

    const handleToggleAutoRenew = (id: string) => {
        setSubscriptions((prev) =>
            prev.map((sub) =>
                sub.id === id ? { ...sub, autoRenew: !sub.autoRenew } : sub
            )
        )
    }

    const handleRenewNow = (id: string) => {
        console.log('Renew subscription:', id)
    }

    const handleSetPrimary = (id: string) => {
        setPaymentMethods((prev) =>
            prev.map((method) => ({
                ...method,
                isPrimary: method.id === id,
            }))
        )
    }

    const handleDeletePaymentMethod = (id: string) => {
        setPaymentMethods((prev) => prev.filter((method) => method.id !== id))
    }

    return (
        <div className="space-y-6">
            <Breadcrumbs items={[{ label: 'Billing' }]} />

            <div>
                <h1 className="text-3xl font-bold text-brand-navy">Billing & Subscriptions</h1>
                <p className="text-gray-600 mt-1">
                    Manage your subscriptions, payment methods, and invoices
                </p>
            </div>

            {/* Billing Alerts */}
            <BillingAlerts />

            {/* Upcoming Charges */}
            <UpcomingCharges />

            {/* Tab Navigation */}
            <div className="border-b border-gray-200">
                <nav className="flex space-x-8">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === tab.id
                                    ? 'border-brand-purple text-brand-purple'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Tab Content */}
            <div>
                {activeTab === 'subscriptions' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {subscriptions.map((subscription) => (
                            <SubscriptionCard
                                key={subscription.id}
                                subscription={subscription}
                                onToggleAutoRenew={handleToggleAutoRenew}
                                onRenewNow={handleRenewNow}
                            />
                        ))}
                    </div>
                )}

                {activeTab === 'payment-methods' && (
                    <div className="space-y-6">
                        <div className="flex justify-end">
                            <Button variant="primary">
                                <Plus className="w-4 h-4 mr-2" />
                                Add Payment Method
                            </Button>
                        </div>
                        <div className="space-y-4">
                            {paymentMethods.map((method) => (
                                <PaymentMethodCard
                                    key={method.id}
                                    method={method}
                                    onSetPrimary={handleSetPrimary}
                                    onDelete={handleDeletePaymentMethod}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'invoices' && (
                    <div className="text-center py-12 text-gray-500">
                        <p>Invoice history coming soon...</p>
                    </div>
                )}
            </div>
        </div>
    )
}
