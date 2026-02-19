import { API_BASE_URL } from './config'

export interface AuditLogEntry {
    id: number
    user: {
        id: number
        username: string
        email: string
        first_name: string
        last_name: string
    }
    project: number | null
    project_name: string | null
    action: string
    description: string
    ip_address: string | null
    metadata: Record<string, unknown>
    timestamp: string
}

export interface AuditLogFilters {
    projectId?: string | number
    action?: string
}

const authHeader = (token: string) => ({ 'Authorization': `Token ${token}` })

export const auditLogAPI = {
    /**
     * GET /api/audit-logs/
     * Fetch audit logs with optional project and action filters.
     * - Super Admin: all logs
     * - Site Owner / Collaborator: only accessible project logs
     */
    getLogs: async (token: string, filters: AuditLogFilters = {}): Promise<AuditLogEntry[]> => {
        const params = new URLSearchParams()
        if (filters.projectId) params.append('project', String(filters.projectId))
        if (filters.action && filters.action !== 'all') params.append('action', filters.action)

        const url = `${API_BASE_URL}/api/audit-logs/${params.toString() ? `?${params}` : ''}`
        const response = await fetch(url, { headers: authHeader(token) })

        if (!response.ok) {
            const err = await response.json().catch(() => ({}))
            throw new Error(err?.error || `Failed to fetch audit logs (${response.status})`)
        }
        return response.json()
    },

    /**
     * GET /api/audit-logs/my_logs/
     * Fetch only the current user's activity logs (latest 50).
     */
    getMyLogs: async (token: string): Promise<AuditLogEntry[]> => {
        const response = await fetch(`${API_BASE_URL}/api/audit-logs/my_logs/`, {
            headers: authHeader(token),
        })
        if (!response.ok) {
            const err = await response.json().catch(() => ({}))
            throw new Error(err?.error || `Failed to fetch activity logs (${response.status})`)
        }
        return response.json()
    },
}
