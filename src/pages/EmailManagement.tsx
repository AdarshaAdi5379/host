import { EmailAccountCreator } from '@/components/email/EmailAccountCreator'
import { EmailAccountList } from '@/components/email/EmailAccountList'
import { EmailSecurity } from '@/components/email/EmailSecurity'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { useState } from 'react'

type Tab = 'accounts' | 'security'

export function EmailManagement() {
    const [activeTab, setActiveTab] = useState<Tab>('accounts')

    const tabs: { id: Tab; label: string }[] = [
        { id: 'accounts', label: 'Email Accounts' },
        { id: 'security', label: 'Security & Deliverability' },
    ]

    return (
        <div className="space-y-6">
            <Breadcrumbs items={[{ label: 'Emails' }]} />

            <div>
                <h1 className="text-3xl font-bold text-brand-navy">Email Management</h1>
                <p className="text-gray-600 mt-1">
                    Create and manage professional business email communications
                </p>
            </div>

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
                {activeTab === 'accounts' && (
                    <div className="space-y-6">
                        <EmailAccountCreator />
                        <EmailAccountList />
                    </div>
                )}
                {activeTab === 'security' && <EmailSecurity />}
            </div>
        </div>
    )
}
