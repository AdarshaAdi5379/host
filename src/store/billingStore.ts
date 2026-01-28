import { create } from 'zustand'

export interface PaymentMethod {
    id: string
    type: 'card' | 'paypal' | 'upi' | 'netbanking'
    last4?: string
    brand?: string
    expiryMonth?: number
    expiryYear?: number
    isPrimary: boolean
    holderName?: string
}

export interface BillingDetails {
    companyName: string
    address: string
    city: string
    state: string
    country: string
    postalCode: string
    taxId: string
    taxIdType: 'GST' | 'VAT' | 'EIN' | 'OTHER'
}

interface BillingState {
    primaryPaymentMethod: PaymentMethod | null
    billingDetails: BillingDetails
    currency: 'USD' | 'INR' | 'EUR'
    setPrimaryPaymentMethod: (method: PaymentMethod) => void
    updateBillingDetails: (details: Partial<BillingDetails>) => void
    setCurrency: (currency: 'USD' | 'INR' | 'EUR') => void
}

export const useBillingStore = create<BillingState>((set) => ({
    primaryPaymentMethod: null,
    billingDetails: {
        companyName: '',
        address: '',
        city: '',
        state: '',
        country: 'US',
        postalCode: '',
        taxId: '',
        taxIdType: 'OTHER',
    },
    currency: 'USD',
    setPrimaryPaymentMethod: (method) => set({ primaryPaymentMethod: method }),
    updateBillingDetails: (details) =>
        set((state) => ({
            billingDetails: { ...state.billingDetails, ...details },
        })),
    setCurrency: (currency) => set({ currency }),
}))
