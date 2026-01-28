import { useState, useEffect } from 'react'
import { Search, Loader2, Check, X, ShoppingCart, Lightbulb, TrendingUp } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { DomainCart } from '@/components/domains/DomainCart'
import { PrivacyProtectionModal } from '@/components/domains/PrivacyProtectionModal'
import { useDomainSearch } from '@/hooks/useDomainSearch'
import { useDomainStore } from '@/store/domainStore'
import { formatPrice, generateDomainSuggestions, extractDomainName } from '@/lib/domainUtils'
import { useToast } from '@/components/ui/toast'
import type { DomainSuggestion } from '@/types/domain'

export function DomainSearch() {
    const [searchTerm, setSearchTerm] = useState('')
    const [isCartOpen, setIsCartOpen] = useState(false)
    const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false)
    const [selectedDomain, setSelectedDomain] = useState<{ domain: string; price: number } | null>(null)
    const [suggestions, setSuggestions] = useState<DomainSuggestion[]>([])
    const { results, isLoading, isValid } = useDomainSearch(searchTerm)
    const { addToCart, cartItems } = useDomainStore()
    const { addToast } = useToast()

    const handleAddToCart = (domain: string, price: number) => {
        setSelectedDomain({ domain, price })
        setIsPrivacyModalOpen(true)
    }

    const handleEnablePrivacy = () => {
        if (selectedDomain) {
            addToCart(selectedDomain.domain, selectedDomain.price)
            const item = cartItems.find((i) => i.domain === selectedDomain.domain)
            if (item) {
                useDomainStore.getState().updateCartItem(selectedDomain.domain, { whoisPrivacy: true })
            }
            addToast({
                title: 'Added to Cart with Privacy',
                description: `${selectedDomain.domain} added with WHOIS privacy protection`,
                variant: 'success',
            })
        }
        setIsPrivacyModalOpen(false)
        setSelectedDomain(null)
    }

    const handleSkipPrivacy = () => {
        if (selectedDomain) {
            addToCart(selectedDomain.domain, selectedDomain.price)
            addToast({
                title: 'Added to Cart',
                description: `${selectedDomain.domain} has been added to your cart`,
                variant: 'success',
            })
        }
        setIsPrivacyModalOpen(false)
        setSelectedDomain(null)
    }

    const isInCart = (domain: string) => {
        return cartItems.some((item) => item.domain === domain)
    }

    // Generate suggestions when primary domain is taken
    useEffect(() => {
        if (results.length > 0) {
            const primaryTaken = results.filter((d) => !d.available)
            if (primaryTaken.length > 0 && searchTerm) {
                const domainName = extractDomainName(searchTerm)
                const aiSuggestions = generateDomainSuggestions(domainName)
                setSuggestions(aiSuggestions)
            } else {
                setSuggestions([])
            }
        }
    }, [results, searchTerm])

    return (
        <div className="max-w-5xl mx-auto">
            {/* Header */}
            <div className="text-center mb-12">
                <h1 className="text-4xl font-bold text-brand-navy mb-4">
                    Find Your Perfect Domain
                </h1>
                <p className="text-lg text-gray-600">
                    Search for available domains and register them instantly
                </p>
            </div>

            {/* Search Bar */}
            <div className="mb-12">
                <div className="relative max-w-2xl mx-auto">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-6 h-6 text-gray-400" />
                    <Input
                        type="text"
                        placeholder="Enter your domain name (e.g., myawesomesite)"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                        className="pl-14 pr-14 py-6 text-lg"
                    />
                    {isLoading && (
                        <Loader2 className="absolute right-4 top-1/2 transform -translate-y-1/2 w-6 h-6 text-brand-purple animate-spin" />
                    )}
                </div>
                {searchTerm && !isValid && (
                    <p className="text-sm text-red-600 text-center mt-2">
                        Please enter a valid domain name (letters, numbers, and hyphens only)
                    </p>
                )}
            </div>

            {/* Results */}
            {results.length > 0 && (
                <div>
                    <h2 className="text-2xl font-bold text-brand-navy mb-6">
                        Available Domains
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {results.map((domain) => (
                            <Card
                                key={domain.name}
                                className={`transition-all ${domain.available
                                    ? 'hover:shadow-lg hover:border-brand-purple'
                                    : 'opacity-60'
                                    }`}
                            >
                                <CardContent className="p-6">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex-1">
                                            <h3 className="font-bold text-lg text-brand-navy mb-1">
                                                {domain.name}
                                            </h3>
                                            <Badge
                                                variant={domain.available ? 'success' : 'default'}
                                                className="text-xs"
                                            >
                                                {domain.available ? (
                                                    <>
                                                        <Check className="w-3 h-3 mr-1" />
                                                        Available
                                                    </>
                                                ) : (
                                                    <>
                                                        <X className="w-3 h-3 mr-1" />
                                                        Taken
                                                    </>
                                                )}
                                            </Badge>
                                        </div>
                                    </div>

                                    {domain.available && (
                                        <>
                                            <div className="mb-4">
                                                <p className="text-3xl font-bold text-brand-purple">
                                                    {formatPrice(domain.price)}
                                                </p>
                                                <p className="text-sm text-gray-600">/year</p>
                                            </div>

                                            <Button
                                                variant={isInCart(domain.name) ? 'outline' : 'primary'}
                                                className="w-full"
                                                onClick={() => handleAddToCart(domain.name, domain.price)}
                                                disabled={isInCart(domain.name)}
                                            >
                                                {isInCart(domain.name) ? (
                                                    <>
                                                        <Check className="w-4 h-4 mr-2" />
                                                        In Cart
                                                    </>
                                                ) : (
                                                    <>
                                                        <ShoppingCart className="w-4 h-4 mr-2" />
                                                        Add to Cart
                                                    </>
                                                )}
                                            </Button>
                                        </>
                                    )}

                                    {!domain.available && (
                                        <p className="text-sm text-gray-500">
                                            This domain is already registered
                                        </p>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            )}

            {/* Empty State */}
            {!isLoading && searchTerm && results.length === 0 && isValid && (
                <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Search className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                        No results found
                    </h3>
                    <p className="text-gray-600">
                        Try a different domain name
                    </p>
                </div>
            )}

            {/* AI-Powered Suggestions */}
            {suggestions.length > 0 && (
                <div className="mt-12">
                    <div className="flex items-center space-x-2 mb-6">
                        <Lightbulb className="w-6 h-6 text-yellow-600" />
                        <h2 className="text-2xl font-bold text-brand-navy">
                            AI-Powered Suggestions
                        </h2>
                        <Badge variant="default" className="bg-yellow-100 text-yellow-800">
                            <TrendingUp className="w-3 h-3 mr-1" />
                            Smart Alternatives
                        </Badge>
                    </div>
                    <p className="text-gray-600 mb-6">
                        Some domains are taken, but here are great alternatives we think you'll love
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {suggestions.map((suggestion) => (
                            <Card
                                key={suggestion.domain}
                                className="transition-all hover:shadow-lg hover:border-brand-purple"
                            >
                                <CardContent className="p-6">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex-1">
                                            <h3 className="font-bold text-lg text-brand-navy mb-1">
                                                {suggestion.domain}
                                            </h3>
                                            <Badge variant="success" className="text-xs">
                                                <Check className="w-3 h-3 mr-1" />
                                                Available
                                            </Badge>
                                        </div>
                                    </div>

                                    <div className="mb-4">
                                        <p className="text-3xl font-bold text-brand-purple">
                                            {formatPrice(suggestion.price)}
                                        </p>
                                        <p className="text-sm text-gray-600">/year</p>
                                    </div>

                                    <Button
                                        variant={isInCart(suggestion.domain) ? 'outline' : 'primary'}
                                        className="w-full"
                                        onClick={() => handleAddToCart(suggestion.domain, suggestion.price)}
                                        disabled={isInCart(suggestion.domain)}
                                    >
                                        {isInCart(suggestion.domain) ? (
                                            <>
                                                <Check className="w-4 h-4 mr-2" />
                                                In Cart
                                            </>
                                        ) : (
                                            <>
                                                <ShoppingCart className="w-4 h-4 mr-2" />
                                                Add to Cart
                                            </>
                                        )}
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            )}

            {/* Initial State */}
            {!searchTerm && (
                <div className="text-center py-12">
                    <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Search className="w-10 h-10 text-brand-purple" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                        Start Your Search
                    </h3>
                    <p className="text-gray-600 mb-6">
                        Enter a domain name above to check availability
                    </p>
                    <div className="flex flex-wrap justify-center gap-2">
                        <Badge variant="default" className="cursor-pointer hover:bg-gray-200">
                            .com
                        </Badge>
                        <Badge variant="default" className="cursor-pointer hover:bg-gray-200">
                            .net
                        </Badge>
                        <Badge variant="default" className="cursor-pointer hover:bg-gray-200">
                            .org
                        </Badge>
                        <Badge variant="default" className="cursor-pointer hover:bg-gray-200">
                            .in
                        </Badge>
                        <Badge variant="default" className="cursor-pointer hover:bg-gray-200">
                            .tech
                        </Badge>
                        <Badge variant="default" className="cursor-pointer hover:bg-gray-200">
                            .io
                        </Badge>
                    </div>
                </div>
            )}

            {/* Floating Cart Button */}
            {cartItems.length > 0 && (
                <button
                    onClick={() => setIsCartOpen(true)}
                    className="fixed bottom-6 right-6 w-16 h-16 bg-brand-purple text-white rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-110 flex items-center justify-center z-30"
                >
                    <ShoppingCart className="w-6 h-6" />
                    <span className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                        {cartItems.length}
                    </span>
                </button>
            )}

            {/* Cart Drawer */}
            <DomainCart isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />

            {/* Privacy Protection Modal */}
            {selectedDomain && (
                <PrivacyProtectionModal
                    isOpen={isPrivacyModalOpen}
                    onClose={() => {
                        setIsPrivacyModalOpen(false)
                        setSelectedDomain(null)
                    }}
                    onEnable={handleEnablePrivacy}
                    onSkip={handleSkipPrivacy}
                    domain={selectedDomain.domain}
                    years={1}
                    price={2.99}
                />
            )}
        </div>
    )
}
