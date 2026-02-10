import { Copy, Check, AlertCircle, ExternalLink } from 'lucide-react'
import { useState } from 'react'

interface NameserverInstructionsProps {
    nameservers: string[]
    domainName: string
    status: 'pending' | 'active' | 'failed'
}

export default function NameserverInstructions({ nameservers, domainName, status }: NameserverInstructionsProps) {
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

    const copyToClipboard = (text: string, index: number) => {
        navigator.clipboard.writeText(text)
        setCopiedIndex(index)
        setTimeout(() => setCopiedIndex(null), 2000)
    }

    const getStatusBadge = () => {
        switch (status) {
            case 'active':
                return (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                        <span className="w-2 h-2 bg-green-600 rounded-full mr-2"></span>
                        Active
                    </span>
                )
            case 'failed':
                return (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                        <span className="w-2 h-2 bg-red-600 rounded-full mr-2"></span>
                        Failed
                    </span>
                )
            default:
                return (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                        <span className="w-2 h-2 bg-yellow-600 rounded-full mr-2 animate-pulse"></span>
                        Pending Nameserver Update
                    </span>
                )
        }
    }

    return (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Nameserver Configuration</h3>
                {getStatusBadge()}
            </div>

            {/* Instructions */}
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-900">
                        <p className="font-medium mb-1">Update your nameservers</p>
                        <p>Go to your domain registrar (GoDaddy, Namecheap, etc.) and replace your current nameservers with the ones below.</p>
                        <p className="mt-2 text-blue-700">⏱️ Propagation can take up to 24 hours, but usually completes within 1-2 hours.</p>
                    </div>
                </div>
            </div>

            {/* Nameservers */}
            <div className="space-y-3 mb-6">
                <p className="text-sm font-medium text-gray-700">Nameservers for {domainName}:</p>
                {nameservers.map((ns, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                        <div className="flex-1">
                            <p className="text-xs text-gray-500 mb-1">Nameserver {index + 1}</p>
                            <p className="font-mono text-sm text-gray-900">{ns}</p>
                        </div>
                        <button
                            onClick={() => copyToClipboard(ns, index)}
                            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors"
                            title="Copy to clipboard"
                        >
                            {copiedIndex === index ? (
                                <Check className="w-5 h-5 text-green-600" />
                            ) : (
                                <Copy className="w-5 h-5" />
                            )}
                        </button>
                    </div>
                ))}
            </div>

            {/* Common Registrars */}
            <div className="border-t pt-4">
                <p className="text-sm font-medium text-gray-700 mb-3">Need help? Check your registrar's guide:</p>
                <div className="grid grid-cols-2 gap-2">
                    {[
                        { name: 'GoDaddy', url: 'https://www.godaddy.com/help/change-nameservers-for-my-domains-664' },
                        { name: 'Namecheap', url: 'https://www.namecheap.com/support/knowledgebase/article.aspx/767/10/how-to-change-dns-for-a-domain/' },
                        { name: 'Google Domains', url: 'https://support.google.com/domains/answer/3290309' },
                        { name: 'Cloudflare', url: 'https://developers.cloudflare.com/dns/zone-setups/full-setup/setup/' }
                    ].map((registrar) => (
                        <a
                            key={registrar.name}
                            href={registrar.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 p-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                            <ExternalLink className="w-4 h-4" />
                            {registrar.name}
                        </a>
                    ))}
                </div>
            </div>
        </div>
    )
}
