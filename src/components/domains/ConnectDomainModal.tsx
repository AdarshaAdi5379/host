import { useState } from 'react'
import { X, Globe, AlertCircle } from 'lucide-react'
import { domainsAPI, type CustomDomain } from '@/lib/api/domains'
import { useAuthStore } from '@/store/authStore'

interface ConnectDomainModalProps {
    siteId: number
    isOpen: boolean
    onClose: () => void
    onSuccess: (domain: CustomDomain) => void
}

export default function ConnectDomainModal({ siteId, isOpen, onClose, onSuccess }: ConnectDomainModalProps) {
    const [domainName, setDomainName] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const token = useAuthStore(state => state.token)

    if (!isOpen) return null

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!token) {
            setError('Authentication required')
            return
        }

        setLoading(true)
        setError(null)

        try {
            const domain = await domainsAPI.connectDomain(siteId, domainName, token)
            onSuccess(domain)
            setDomainName('')
            onClose()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to connect domain')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <Globe className="w-5 h-5 text-blue-600" />
                        </div>
                        <h2 className="text-xl font-semibold text-gray-900">Connect Custom Domain</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="p-6">
                    <div className="mb-4">
                        <label htmlFor="domain" className="block text-sm font-medium text-gray-700 mb-2">
                            Domain Name
                        </label>
                        <input
                            id="domain"
                            type="text"
                            value={domainName}
                            onChange={(e) => setDomainName(e.target.value)}
                            placeholder="example.com"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            disabled={loading}
                            required
                        />
                        <p className="mt-2 text-sm text-gray-500">
                            Enter your domain without "www" or "https://"
                        </p>
                    </div>

                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-red-800">{error}</p>
                        </div>
                    )}

                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={loading || !domainName.trim()}
                        >
                            {loading ? 'Connecting...' : 'Connect Domain'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
