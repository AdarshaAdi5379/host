import { useState } from 'react'
import { SubscriptionCard } from '@/components/billing/SubscriptionCard'
import { PaymentMethodCard } from '@/components/billing/PaymentMethodCard'
import { UpcomingCharges } from '@/components/billing/UpcomingCharges'
import { BillingAlerts } from '@/components/billing/BillingAlerts'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { Button } from '@/components/ui/button'
import { Plus, CreditCard, FileText, Receipt } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
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
    const { user } = useAuthStore()
    const [activeTab, setActiveTab] = useState<Tab>('subscriptions')

    // Show demo data only for admin
    const isAdmin = user?.role === 'owner'
    const [subscriptions, setSubscriptions] = useState(isAdmin ? mockSubscriptions : [])
    const [paymentMethods, setPaymentMethods] = useState(isAdmin ? mockPaymentMethods : [])

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

    const hasAnyBillingData = subscriptions.length > 0 || paymentMethods.length > 0

    return (
        <div className="space-y-6">
            <Breadcrumbs items={[{ label: 'Billing' }]} />

            <div>
                <h1 className="text-3xl font-bold text-brand-navy">Billing & Subscriptions</h1>
                <p className="text-gray-600 mt-1">
                    Manage your subscriptions, payment methods, and invoices
                </p>
            </div>

            {hasAnyBillingData ? (
                <>
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
                </>
            ) : (
                /* Empty State for Regular Users */
                <div className="py-16">
                    <div className="max-w-3xl mx-auto text-center">
                        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Receipt className="w-12 h-12 text-green-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-brand-navy mb-3">
                            No Billing Information Yet
                        </h2>
                        <p className="text-gray-600 mb-8 max-w-xl mx-auto">
                            You don't have any active subscriptions or payment methods. Start using our services to see your billing information here.
                        </p>

                        {/* Info Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                            <div className="border border-gray-200 rounded-lg p-6">
                                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                                    <FileText className="w-6 h-6 text-blue-600" />
                                </div>
                                <h3 className="font-semibold text-brand-navy mb-2">Subscriptions</h3>
                                <p className="text-sm text-gray-600">
                                    View and manage your active service subscriptions
                                </p>
                            </div>

                            <div className="border border-gray-200 rounded-lg p-6">
                                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                                    <CreditCard className="w-6 h-6 text-brand-purple" />
                                </div>
                                <h3 className="font-semibold text-brand-navy mb-2">Payment Methods</h3>
                                <p className="text-sm text-gray-600">
                                    Add and manage your payment cards securely
                                </p>
                            </div>

                            <div className="border border-gray-200 rounded-lg p-6">
                                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                                    <Receipt className="w-6 h-6 text-green-600" />
                                </div>
                                <h3 className="font-semibold text-brand-navy mb-2">Invoices</h3>
                                <p className="text-sm text-gray-600">
                                    Download and view your billing history
                                </p>
                            </div>
                        </div>

                        <p className="text-sm text-gray-500">
                            Billing information will appear here once you start using our services
                        </p>
                    </div>
                </div>
            )}
        </div>
    )
}
