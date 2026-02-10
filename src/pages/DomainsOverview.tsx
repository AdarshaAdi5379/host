import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Globe, Plus, RefreshCw, ExternalLink, Settings } from 'lucide-react'
import { wordpressAPI, type WordPressSite } from '@/lib/wordpressAPI'
import { domainsAPI, type CustomDomain } from '@/lib/api/domains'
import { useAuthStore } from '@/store/authStore'

interface DomainWithSite extends CustomDomain {
    site_details?: WordPressSite
}

export default function DomainsOverview() {
    const navigate = useNavigate()
    const token = useAuthStore(state => state.token)

    const [domains, setDomains] = useState<DomainWithSite[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (token) {
            loadAllDomains()
        }
    }, [token])

    const loadAllDomains = async () => {
        if (!token) return

        setLoading(true)
        setError(null)

        try {
            // First, get all sites
            const sitesData = await wordpressAPI.getSites()

            // Then, fetch domains for each site
            const allDomains: DomainWithSite[] = []

            for (const site of sitesData) {
                try {
                    const siteDomains = await domainsAPI.getDomains(site.id, token)
                    const domainsWithSite = siteDomains.map(domain => ({
                        ...domain,
                        site_details: site
                    }))
                    allDomains.push(...domainsWithSite)
                } catch (err) {
                    // Skip sites with errors
                    console.error(`Failed to load domains for site ${site.id}:`, err)
                }
            }

            setDomains(allDomains)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load domains')
        } finally {
            setLoading(false)
        }
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'active':
                return (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Active
                    </span>
                )
            case 'failed':
                return (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        Failed
                    </span>
                )
            default:
                return (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        Pending
                    </span>
                )
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
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Custom Domains</h1>
                            <p className="text-sm text-gray-600 mt-1">
                                Manage custom domains across all your sites
                            </p>
                        </div>
                        <button
                            onClick={() => navigate('/hosting')}
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

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white border border-gray-200 rounded-lg p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Total Domains</p>
                                <p className="text-3xl font-bold text-gray-900 mt-1">{domains.length}</p>
                            </div>
                            <Globe className="w-12 h-12 text-blue-600 opacity-20" />
                        </div>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-lg p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Active Domains</p>
                                <p className="text-3xl font-bold text-green-600 mt-1">
                                    {domains.filter(d => d.status === 'active').length}
                                </p>
                            </div>
                            <Globe className="w-12 h-12 text-green-600 opacity-20" />
                        </div>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-lg p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Pending Setup</p>
                                <p className="text-3xl font-bold text-yellow-600 mt-1">
                                    {domains.filter(d => d.status === 'pending').length}
                                </p>
                            </div>
                            <Globe className="w-12 h-12 text-yellow-600 opacity-20" />
                        </div>
                    </div>
                </div>

                {/* Domains Table */}
                {domains.length === 0 ? (
                    <div className="bg-white border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
                        <Globe className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">No custom domains yet</h3>
                        <p className="text-gray-600 mb-6">
                            Connect your first custom domain to get started
                        </p>
                        <button
                            onClick={() => navigate('/hosting')}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            <Plus className="w-5 h-5" />
                            Go to Hosting
                        </button>
                    </div>
                ) : (
                    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Domain
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Site
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Created
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {domains.map((domain) => (
                                    <tr key={domain.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <Globe className="w-5 h-5 text-gray-400 mr-3" />
                                                <div>
                                                    <div className="text-sm font-medium text-gray-900">
                                                        {domain.domain_name}
                                                    </div>
                                                    {domain.status === 'active' && (
                                                        <a
                                                            href={`https://${domain.domain_name}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                                                        >
                                                            Visit <ExternalLink className="w-3 h-3" />
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-900">{domain.site_name}</div>
                                            <div className="text-xs text-gray-500">
                                                {domain.site_details?.domain || 'N/A'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {getStatusBadge(domain.status)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {new Date(domain.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button
                                                onClick={() => navigate(`/sites/${domain.site}/domains`)}
                                                className="text-blue-600 hover:text-blue-900 inline-flex items-center gap-1"
                                            >
                                                <Settings className="w-4 h-4" />
                                                Manage
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}
