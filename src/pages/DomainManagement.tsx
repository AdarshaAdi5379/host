import { DomainPortfolio } from '@/components/domains/DomainPortfolio'
import { NameserverManager } from '@/components/domains/NameserverManager'
import { DomainSecurity } from '@/components/domains/DomainSecurity'
import { DNSEditor } from '@/pages/hosting/DNSEditor'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { useState } from 'react'

type Tab = 'portfolio' | 'dns' | 'nameservers' | 'security'

export function DomainManagement() {
    const [activeTab, setActiveTab] = useState<Tab>('portfolio')

    const tabs: { id: Tab; label: string }[] = [
        { id: 'portfolio', label: 'Portfolio' },
        { id: 'dns', label: 'DNS Zone' },
        { id: 'nameservers', label: 'Nameservers' },
        { id: 'security', label: 'Security' },
    ]

    return (
        <div className="space-y-6">
            <Breadcrumbs items={[{ label: 'Domains' }]} />

            <div>
                <h1 className="text-3xl font-bold text-brand-navy">Domain Management</h1>
                <p className="text-gray-600 mt-1">
                    Manage your domain lifecycle, connectivity, and security
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
                {activeTab === 'portfolio' && <DomainPortfolio />}
                {activeTab === 'dns' && <DNSEditor />}
                {activeTab === 'nameservers' && <NameserverManager />}
                {activeTab === 'security' && <DomainSecurity />}
            </div>
        </div>
    )
}
