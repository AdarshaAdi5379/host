import { X, Shield, Eye, EyeOff, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatPrice } from '@/lib/domainUtils'

interface PrivacyProtectionModalProps {
    isOpen: boolean
    onClose: () => void
    onEnable: () => void
    onSkip: () => void
    domain: string
    years: number
    price: number
}

export function PrivacyProtectionModal({
    isOpen,
    onClose,
    onEnable,
    onSkip,
    domain,
    years,
    price,
}: PrivacyProtectionModalProps) {
    if (!isOpen) return null

    const totalPrice = price * years

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
                onClick={onClose}
            >
                {/* Modal */}
                <div
                    className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="p-6 border-b border-gray-200">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center space-x-3">
                                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                                    <Shield className="w-6 h-6 text-brand-purple" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-brand-navy">
                                        WHOIS Privacy Protection
                                    </h2>
                                    <p className="text-sm text-gray-600 mt-1">
                                        Protect your personal information from public databases
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-6">
                        {/* What is WHOIS Privacy */}
                        <div>
                            <h3 className="font-semibold text-brand-navy mb-3">
                                What is WHOIS Privacy Protection?
                            </h3>
                            <p className="text-gray-600 text-sm leading-relaxed">
                                When you register a domain, your personal contact information (name, email, phone,
                                address) is published in the public WHOIS database. WHOIS Privacy Protection
                                replaces your information with our privacy service details, keeping your data safe
                                from spammers, scammers, and identity thieves.
                            </p>
                        </div>

                        {/* Comparison */}
                        <div className="grid grid-cols-2 gap-4">
                            {/* Without Privacy */}
                            <div className="border border-red-200 rounded-lg p-4 bg-red-50">
                                <div className="flex items-center space-x-2 mb-3">
                                    <EyeOff className="w-5 h-5 text-red-600" />
                                    <h4 className="font-semibold text-red-900">Without Privacy</h4>
                                </div>
                                <ul className="space-y-2 text-sm text-red-800">
                                    <li className="flex items-start space-x-2">
                                        <X className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                        <span>Your name publicly visible</span>
                                    </li>
                                    <li className="flex items-start space-x-2">
                                        <X className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                        <span>Email exposed to spammers</span>
                                    </li>
                                    <li className="flex items-start space-x-2">
                                        <X className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                        <span>Phone number accessible</span>
                                    </li>
                                    <li className="flex items-start space-x-2">
                                        <X className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                        <span>Home address public</span>
                                    </li>
                                </ul>
                            </div>

                            {/* With Privacy */}
                            <div className="border border-green-200 rounded-lg p-4 bg-green-50">
                                <div className="flex items-center space-x-2 mb-3">
                                    <Eye className="w-5 h-5 text-green-600" />
                                    <h4 className="font-semibold text-green-900">With Privacy</h4>
                                </div>
                                <ul className="space-y-2 text-sm text-green-800">
                                    <li className="flex items-start space-x-2">
                                        <Check className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                        <span>Your identity protected</span>
                                    </li>
                                    <li className="flex items-start space-x-2">
                                        <Check className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                        <span>No spam emails</span>
                                    </li>
                                    <li className="flex items-start space-x-2">
                                        <Check className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                        <span>Phone privacy maintained</span>
                                    </li>
                                    <li className="flex items-start space-x-2">
                                        <Check className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                        <span>Address kept private</span>
                                    </li>
                                </ul>
                            </div>
                        </div>

                        {/* Benefits */}
                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                            <h4 className="font-semibold text-purple-900 mb-3">Key Benefits</h4>
                            <ul className="space-y-2 text-sm text-purple-800">
                                <li className="flex items-start space-x-2">
                                    <Check className="w-4 h-4 mt-0.5 text-purple-600" />
                                    <span>Reduce spam and unwanted solicitations by up to 90%</span>
                                </li>
                                <li className="flex items-start space-x-2">
                                    <Check className="w-4 h-4 mt-0.5 text-purple-600" />
                                    <span>Protect against identity theft and fraud</span>
                                </li>
                                <li className="flex items-start space-x-2">
                                    <Check className="w-4 h-4 mt-0.5 text-purple-600" />
                                    <span>Prevent domain hijacking attempts</span>
                                </li>
                                <li className="flex items-start space-x-2">
                                    <Check className="w-4 h-4 mt-0.5 text-purple-600" />
                                    <span>Maintain professional appearance</span>
                                </li>
                            </ul>
                        </div>

                        {/* Pricing */}
                        <div className="border border-gray-200 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <p className="text-sm text-gray-600">Domain</p>
                                    <p className="font-semibold text-brand-navy">{domain}</p>
                                </div>
                                <Badge variant="default">{years} {years === 1 ? 'year' : 'years'}</Badge>
                            </div>

                            <div className="space-y-2 text-sm">
                                <div className="flex items-center justify-between">
                                    <span className="text-gray-600">WHOIS Privacy Protection</span>
                                    <span className="font-semibold">{formatPrice(2.99)}/year</span>
                                </div>
                                <div className="flex items-center justify-between text-lg font-bold pt-2 border-t border-gray-200">
                                    <span>Total Privacy Cost</span>
                                    <span className="text-brand-purple">{formatPrice(totalPrice)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Recommendation */}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <p className="text-sm text-blue-900 font-medium mb-1">
                                ⭐ Recommended for 98% of domain owners
                            </p>
                            <p className="text-sm text-blue-700">
                                Most domain owners choose privacy protection to safeguard their personal information.
                                You can always disable it later if needed.
                            </p>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-6 border-t border-gray-200 bg-gray-50">
                        <div className="flex items-center justify-between space-x-3">
                            <Button variant="outline" onClick={onSkip} className="flex-1">
                                Skip for Now
                            </Button>
                            <Button variant="primary" onClick={onEnable} className="flex-1">
                                <Shield className="w-4 h-4 mr-2" />
                                Enable Privacy Protection
                            </Button>
                        </div>
                        <p className="text-xs text-gray-600 text-center mt-3">
                            You can enable or disable privacy protection anytime from your domain settings
                        </p>
                    </div>
                </div>
            </div>
        </>
    )
}
