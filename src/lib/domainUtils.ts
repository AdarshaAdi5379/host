import type { Domain, DomainSuggestion } from '@/types/domain'

// Common TLDs with pricing
export const COMMON_TLDS = [
    { extension: '.com', price: 12.99, popular: true },
    { extension: '.net', price: 14.99, popular: true },
    { extension: '.org', price: 13.99, popular: true },
    { extension: '.in', price: 9.99, popular: true },
    { extension: '.tech', price: 19.99, popular: false },
    { extension: '.io', price: 39.99, popular: false },
    { extension: '.dev', price: 14.99, popular: false },
    { extension: '.app', price: 14.99, popular: false },
    { extension: '.co', price: 24.99, popular: false },
    { extension: '.me', price: 19.99, popular: false },
]

/**
 * Validate domain name format
 */
export function isValidDomainName(domain: string): boolean {
    // Remove TLD if present
    const nameOnly = domain.split('.')[0]

    // Domain name rules:
    // - 1-63 characters
    // - Only alphanumeric and hyphens
    // - Cannot start or end with hyphen
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/

    return domainRegex.test(nameOnly)
}

/**
 * Extract TLD from domain name
 */
export function extractTLD(domain: string): string {
    const parts = domain.split('.')
    if (parts.length < 2) return ''
    return '.' + parts[parts.length - 1]
}

/**
 * Extract domain name without TLD
 */
export function extractDomainName(domain: string): string {
    return domain.split('.')[0]
}

/**
 * Format price with currency
 */
export function formatPrice(price: number): string {
    return `$${price.toFixed(2)}`
}

/**
 * Mock domain availability check
 */
export async function checkDomainAvailability(domainName: string): Promise<Domain[]> {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 500))

    // Mock availability logic
    const results: Domain[] = COMMON_TLDS.map((tld) => {
        const fullDomain = domainName + tld.extension
        // Randomly mark some domains as taken
        const available = Math.random() > 0.3

        return {
            name: fullDomain,
            tld: tld.extension,
            available,
            price: tld.price,
            premium: false,
        }
    })

    return results
}

/**
 * Generate AI-powered domain suggestions
 */
export function generateDomainSuggestions(domainName: string, takenTLDs: string[] = []): DomainSuggestion[] {
    const suggestions: DomainSuggestion[] = []

    // Alternative prefixes/suffixes
    const prefixes = ['get', 'my', 'the', 'try', 'use', 'go']
    const suffixes = ['app', 'online', 'hq', 'hub', 'io', 'tech', 'now', 'pro']

    // Add prefix suggestions
    prefixes.slice(0, 2).forEach((prefix) => {
        const suggested = `${prefix}${domainName}`
        suggestions.push({
            domain: suggested + '.com',
            available: true,
            price: 12.99,
            tld: '.com',
            type: 'alternative',
            score: 85,
        })
    })

    // Add suffix suggestions
    suffixes.slice(0, 3).forEach((suffix) => {
        suggestions.push({
            domain: `${domainName}${suffix}.com`,
            available: true,
            price: 12.99,
            tld: '.com',
            type: 'alternative',
            score: 80,
        })
    })

    // Add alternative TLD suggestions
    const altTLDs = ['.io', '.tech', '.app', '.dev']
    altTLDs.slice(0, 2).forEach((tld) => {
        const tldInfo = COMMON_TLDS.find((t) => t.extension === tld)
        if (tldInfo) {
            suggestions.push({
                domain: domainName + tld,
                available: true,
                price: tldInfo.price,
                tld,
                type: 'alternative',
                score: 75,
            })
        }
    })

    return suggestions.slice(0, 6)
}

/**
 * Validate EPP/Auth code format
 */
export function isValidEPPCode(code: string): boolean {
    // EPP codes are typically 8-32 characters, alphanumeric
    return code.length >= 8 && code.length <= 32 && /^[a-zA-Z0-9]+$/.test(code)
}

/**
 * Check if domain is locked (mock)
 */
export async function checkDomainLockStatus(domain: string): Promise<{ locked: boolean; registrar: string }> {
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Mock response
    return {
        locked: Math.random() > 0.5,
        registrar: ['GoDaddy', 'Namecheap', 'Google Domains', 'Cloudflare'][Math.floor(Math.random() * 4)],
    }
}

/**
 * Validate transfer eligibility
 */
export async function validateTransferEligibility(domain: string, eppCode: string): Promise<{
    eligible: boolean
    reason?: string
}> {
    await new Promise((resolve) => setTimeout(resolve, 1500))

    if (!isValidEPPCode(eppCode)) {
        return {
            eligible: false,
            reason: 'Invalid EPP/Auth code format',
        }
    }

    // Mock validation
    const eligible = Math.random() > 0.2

    return {
        eligible,
        reason: eligible ? undefined : 'Domain is locked or recently registered (must be 60+ days old)',
    }
}
