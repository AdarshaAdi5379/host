/**
 * Shared API base URL.
 *
 * Priority:
 * 1) explicit Vite env (`VITE_API_BASE_URL`)
 * 2) localhost dev default (`http://localhost:8001`)
 * 3) current browser origin (for deployed same-origin setups)
 */
const envApiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').trim()

function resolveApiBaseUrl(): string {
    if (envApiBaseUrl) return envApiBaseUrl

    if (typeof window !== 'undefined') {
        const host = window.location.hostname
        if (host === 'localhost' || host === '127.0.0.1') {
            return 'http://localhost:8001'
        }
        return window.location.origin
    }

    return 'http://localhost:8001'
}

export const API_BASE_URL = resolveApiBaseUrl()
