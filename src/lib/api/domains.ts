/**
 * API client for Custom Domain management
 */

const API_BASE = 'http://localhost:8000/api/sites'

export interface CustomDomain {
    id: number
    domain_name: string
    site: number
    site_name: string
    cloudflare_zone_id: string
    nameservers: string[]
    status: 'pending' | 'active' | 'failed'
    created_at: string
    updated_at: string
}

export interface ConnectDomainRequest {
    domain_name: string
}

export const domainsAPI = {
    /**
     * Connect a custom domain to a site
     */
    connectDomain: async (siteId: number, domainName: string, token: string): Promise<CustomDomain> => {
        const response = await fetch(`${API_BASE}/${siteId}/connect_domain/`, {
            method: 'POST',
            headers: {
                'Authorization': `Token ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ domain_name: domainName })
        })

        if (response.status === 401) {
            useAuthStore.getState().logout()
            throw new Error('Session expired. Please login again.')
        }

        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Failed to connect domain')
        }

        return response.json()
    },

    /**
     * Get all domains for a site
     */
    getDomains: async (siteId: number, token: string): Promise<CustomDomain[]> => {
        const response = await fetch(`${API_BASE}/${siteId}/domains/`, {
            headers: {
                'Authorization': `Token ${token}`,
                'Content-Type': 'application/json'
            }
        })

        if (response.status === 401) {
            useAuthStore.getState().logout()
            throw new Error('Session expired. Please login again.')
        }

        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Failed to fetch domains')
        }

        return response.json()
    },

    /**
     * Remove a custom domain
     */
    removeDomain: async (siteId: number, domainId: number, token: string): Promise<void> => {
        const response = await fetch(`${API_BASE}/${siteId}/domains/${domainId}/`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Token ${token}`,
                'Content-Type': 'application/json'
            }
        })

        if (response.status === 401) {
            useAuthStore.getState().logout()
            throw new Error('Session expired. Please login again.')
        }

        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Failed to remove domain')
        }
    }
}

import { useAuthStore } from '@/store/authStore'
