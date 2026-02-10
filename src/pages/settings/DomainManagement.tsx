import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Globe, Plus, Trash2, RefreshCw, ArrowLeft } from 'lucide-react'
import { domainsAPI, type CustomDomain } from '@/lib/api/domains'
import { useAuthStore } from '@/store/authStore'
import ConnectDomainModal from '@/components/domains/ConnectDomainModal'
import NameserverInstructions from '@/components/domains/NameserverInstructions'

export default function DomainManagement() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const token = useAuthStore(state => state.token)

    const [domains, setDomains] = useState<CustomDomain[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [showConnectModal, setShowConnectModal] = useState(false)
    const [selectedDomain, setSelectedDomain] = useState<CustomDomain | null>(null)

    const siteId = parseInt(id || '0')

    useEffect(() => {
        if (token && siteId) {
            loadDomains()
        }
    }, [token, siteId])

    const loadDomains = async () => {
        if (!token) return

        setLoading(true)
        setError(null)

        try {
            const data = await domainsAPI.getDomains(siteId, token)
            setDomains(data)
            if (data.length > 0) {
                setSelectedDomain(data[0])
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load domains')
        } finally {
            setLoading(false)
        }
    }

    const handleDomainConnected = (domain: CustomDomain) => {
        setDomains(prev => [...prev, domain])
        setSelectedDomain(domain)
    }

    const handleRemoveDomain = async (domainId: number) => {
        if (!token || !confirm('Are you sure you want to remove this domain?')) return

        try {
            await domainsAPI.removeDomain(siteId, domainId, token)
            setDomains(prev => prev.filter(d => d.id !== domainId))
            if (selectedDomain?.id === domainId) {
                setSelectedDomain(domains[0] || null)
            }
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to remove domain')
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-2" />
                    <p className="text-gray-600">Loading domains...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => navigate(`/sites/${siteId}`)}
                                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">Custom Domains</h1>
                                <p className="text-sm text-gray-600 mt-1">Connect your own domain to this site</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowConnectModal(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            <Plus className="w-5 h-5" />
                            Connect Domain
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
                        {error}
                    </div>
                )}

                {domains.length === 0 ? (
                    <div className="bg-white border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
                        <Globe className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">No custom domains yet</h3>
                        <p className="text-gray-600 mb-6">Connect your own domain to make your site accessible at a custom URL</p>
                        <button
                            onClick={() => setShowConnectModal(true)}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            <Plus className="w-5 h-5" />
                            Connect Your First Domain
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Domain List */}
                        <div className="lg:col-span-1">
                            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                                <div className="p-4 border-b bg-gray-50">
                                    <h3 className="font-semibold text-gray-900">Connected Domains</h3>
                                </div>
                                <div className="divide-y">
                                    {domains.map(domain => (
                                        <div
                                            key={domain.id}
                                            className={`p-4 cursor-pointer transition-colors ${selectedDomain?.id === domain.id
                                                    ? 'bg-blue-50 border-l-4 border-blue-600'
                                                    : 'hover:bg-gray-50'
                                                }`}
                                            onClick={() => setSelectedDomain(domain)}
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-gray-900 truncate">{domain.domain_name}</p>
                                                    <p className="text-xs text-gray-500 mt-1">
                                                        {domain.status === 'active' ? '✓ Active' : '⏱ Pending'}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        handleRemoveDomain(domain.id)
                                                    }}
                                                    className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                                    title="Remove domain"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Domain Details */}
                        <div className="lg:col-span-2">
                            {selectedDomain && (
                                <NameserverInstructions
                                    nameservers={selectedDomain.nameservers}
                                    domainName={selectedDomain.domain_name}
                                    status={selectedDomain.status}
                                />
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Connect Domain Modal */}
            <ConnectDomainModal
                siteId={siteId}
                isOpen={showConnectModal}
                onClose={() => setShowConnectModal(false)}
                onSuccess={handleDomainConnected}
            />
        </div>
    )
}
