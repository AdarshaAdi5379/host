import { useNavigate } from 'react-router-dom'
import { X, ShoppingCart, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useDomainStore } from '@/store/domainStore'
import { formatPrice } from '@/lib/domainUtils'

interface DomainCartProps {
    isOpen: boolean
    onClose: () => void
}

export function DomainCart({ isOpen, onClose }: DomainCartProps) {
    const navigate = useNavigate()
    const { cartItems, removeFromCart, updateCartItem, getTotalPrice, clearCart } = useDomainStore()

    const handleCheckout = () => {
        onClose()
        navigate('/domains/checkout')
    }

    if (!isOpen) return null

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 z-40 transition-opacity"
                onClick={onClose}
            />

            {/* Drawer */}
            <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl z-50 flex flex-col animate-slide-in-right">
                {/* Header */}
                <div className="p-6 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-brand-purple rounded-lg flex items-center justify-center">
                                <ShoppingCart className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-brand-navy">Your Cart</h2>
                                <p className="text-sm text-gray-600">
                                    {cartItems.length} {cartItems.length === 1 ? 'domain' : 'domains'}
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

                {/* Cart Items */}
                <div className="flex-1 overflow-y-auto p-6">
                    {cartItems.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <ShoppingCart className="w-8 h-8 text-gray-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                Your cart is empty
                            </h3>
                            <p className="text-gray-600 mb-6">
                                Add domains to get started
                            </p>
                            <Button variant="primary" onClick={onClose}>
                                Search Domains
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {cartItems.map((item) => (
                                <div
                                    key={item.domain}
                                    className="p-4 border border-gray-200 rounded-lg hover:border-brand-purple transition-colors"
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex-1">
                                            <h3 className="font-semibold text-brand-navy mb-1">
                                                {item.domain}
                                            </h3>
                                            <p className="text-sm text-gray-600">
                                                {formatPrice(item.price)}/year
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => removeFromCart(item.domain)}
                                            className="p-2 hover:bg-red-50 rounded-lg transition-colors text-red-600"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>

                                    {/* Years Selector */}
                                    <div className="mb-3">
                                        <label className="text-sm font-medium text-gray-700 mb-2 block">
                                            Registration Period
                                        </label>
                                        <select
                                            value={item.years}
                                            onChange={(e) =>
                                                updateCartItem(item.domain, { years: parseInt(e.target.value) })
                                            }
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent"
                                        >
                                            {[1, 2, 3, 5, 10].map((year) => (
                                                <option key={year} value={year}>
                                                    {year} {year === 1 ? 'year' : 'years'} - {formatPrice(item.price * year)}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* WHOIS Privacy */}
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={item.whoisPrivacy}
                                            onChange={(e) =>
                                                updateCartItem(item.domain, { whoisPrivacy: e.target.checked })
                                            }
                                            className="rounded border-gray-300 text-brand-purple focus:ring-brand-purple"
                                        />
                                        <span className="text-sm text-gray-700">
                                            WHOIS Privacy Protection (+{formatPrice(2.99 * item.years)})
                                        </span>
                                    </label>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {cartItems.length > 0 && (
                    <div className="p-6 border-t border-gray-200 bg-gray-50">
                        <div className="mb-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-gray-600">Subtotal</span>
                                <span className="font-semibold">{formatPrice(getTotalPrice())}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm text-gray-600">
                                <span>Taxes calculated at checkout</span>
                            </div>
                        </div>

                        <div className="flex items-center justify-between mb-4 pt-4 border-t border-gray-200">
                            <span className="text-lg font-bold text-brand-navy">Total</span>
                            <span className="text-2xl font-bold text-brand-purple">
                                {formatPrice(getTotalPrice())}
                            </span>
                        </div>

                        <div className="space-y-2">
                            <Button
                                variant="primary"
                                className="w-full"
                                onClick={handleCheckout}
                            >
                                Proceed to Checkout
                            </Button>
                            <Button
                                variant="outline"
                                className="w-full"
                                onClick={() => {
                                    if (confirm('Are you sure you want to clear your cart?')) {
                                        clearCart()
                                    }
                                }}
                            >
                                Clear Cart
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </>
    )
}
