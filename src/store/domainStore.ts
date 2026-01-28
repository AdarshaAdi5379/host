import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CartItem } from '@/types/domain'

interface DomainState {
    cartItems: CartItem[]
    addToCart: (domain: string, price: number) => void
    removeFromCart: (domain: string) => void
    updateCartItem: (domain: string, updates: Partial<CartItem>) => void
    clearCart: () => void
    getTotalPrice: () => number
}

export const useDomainStore = create<DomainState>()(
    persist(
        (set, get) => ({
            cartItems: [],

            addToCart: (domain, price) => {
                const existingItem = get().cartItems.find((item) => item.domain === domain)
                if (existingItem) return

                set((state) => ({
                    cartItems: [
                        ...state.cartItems,
                        {
                            domain,
                            price,
                            years: 1,
                            whoisPrivacy: false,
                        },
                    ],
                }))
            },

            removeFromCart: (domain) =>
                set((state) => ({
                    cartItems: state.cartItems.filter((item) => item.domain !== domain),
                })),

            updateCartItem: (domain, updates) =>
                set((state) => ({
                    cartItems: state.cartItems.map((item) =>
                        item.domain === domain ? { ...item, ...updates } : item
                    ),
                })),

            clearCart: () => set({ cartItems: [] }),

            getTotalPrice: () => {
                const items = get().cartItems
                return items.reduce((total, item) => {
                    const domainCost = item.price * item.years
                    const privacyCost = item.whoisPrivacy ? 2.99 * item.years : 0
                    return total + domainCost + privacyCost
                }, 0)
            },
        }),
        {
            name: 'domain-cart-storage',
            partialize: (state) => ({
                cartItems: state.cartItems,
            }),
        }
    )
)
