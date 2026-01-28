export interface Domain {
    name: string
    tld: string
    available: boolean
    price: number
    premium: boolean
}

export interface TLD {
    extension: string
    price: number
    popular: boolean
}

export interface CartItem {
    domain: string
    price: number
    years: number
    whoisPrivacy: boolean
}

export interface CheckoutData {
    domains: CartItem[]
    contactInfo: {
        firstName: string
        lastName: string
        email: string
        phone: string
        address: string
        city: string
        state: string
        zipCode: string
        country: string
    }
    nameservers: {
        type: 'default' | 'custom'
        ns1?: string
        ns2?: string
        ns3?: string
        ns4?: string
    }
    paymentMethod: string
    total: number
}

export interface DomainSearchResult {
    query: string
    results: Domain[]
    timestamp: number
}

export interface DomainTransfer {
    id: string
    domain: string
    eppCode: string
    status: TransferStatus
    currentRegistrar: string
    isLocked: boolean
    expiryDate: string
    nameserverOption: 'keep' | 'switch'
    transferStarted?: string
    transferCompleted?: string
    estimatedCompletion?: string
}

export const TransferStatus = {
    PENDING_UNLOCK: 'pending_unlock',
    PENDING_CODE: 'pending_code',
    VALIDATING: 'validating',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'cancelled',
} as const

export type TransferStatus = typeof TransferStatus[keyof typeof TransferStatus]

export interface TransferStep {
    id: number
    title: string
    description: string
    status: 'completed' | 'current' | 'pending'
    actionRequired?: boolean
}

export interface DomainSuggestion {
    domain: string
    available: boolean
    price: number
    tld: string
    type: 'exact' | 'alternative' | 'premium'
    score?: number
}
