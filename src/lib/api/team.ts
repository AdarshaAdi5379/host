import { API_BASE_URL } from './config'

export interface TeamMember {
    id: number
    project: number
    project_name: string
    user: {
        id: number
        username: string
        email: string
        first_name: string
        last_name: string
        date_joined: string
    }
    invited_by: {
        id: number
        username: string
        email: string
    } | null
    role: 'owner' | 'collaborator'
    permissions: Record<string, unknown>
    joined_at: string
    updated_at: string
}

const headers = (token: string) => ({
    'Authorization': `Token ${token}`,
    'Content-Type': 'application/json',
})

export const teamAPI = {
    /**
     * GET /api/team/{projectId}/members/
     * List all team members for a project.
     */
    getMembers: async (projectId: string | number, token: string): Promise<TeamMember[]> => {
        const response = await fetch(`${API_BASE_URL}/api/team/${projectId}/members/`, {
            headers: { 'Authorization': `Token ${token}` },
        })
        if (!response.ok) {
            const err = await response.json().catch(() => ({}))
            throw new Error(err?.error || `Failed to load team members (${response.status})`)
        }
        return response.json()
    },

    /**
     * POST /api/team/{projectId}/invite/
     * Invite a user (by email) to join the project with a given role.
     */
    inviteMember: async (
        projectId: string | number,
        email: string,
        role: 'owner' | 'collaborator',
        token: string,
    ): Promise<TeamMember> => {
        const response = await fetch(`${API_BASE_URL}/api/team/${projectId}/invite/`, {
            method: 'POST',
            headers: headers(token),
            body: JSON.stringify({ email, role }),
        })
        if (!response.ok) {
            const err = await response.json().catch(() => ({}))
            // Handle DRF validation errors (e.g. {email: ["msg"]}) and plain {error: "msg"}
            const message =
                err?.error ||
                err?.email?.[0] ||
                err?.role?.[0] ||
                err?.non_field_errors?.[0] ||
                `Failed to invite member (${response.status})`
            throw new Error(message)
        }
        return response.json()
    },


    /**
     * POST /api/team/{projectId}/remove/{userId}/
     * Remove a member from the project.
     */
    removeMember: async (
        projectId: string | number,
        userId: number,
        token: string,
    ): Promise<void> => {
        const response = await fetch(`${API_BASE_URL}/api/team/${projectId}/remove/${userId}/`, {
            method: 'POST',
            headers: { 'Authorization': `Token ${token}` },
        })
        if (!response.ok) {
            const err = await response.json().catch(() => ({}))
            throw new Error(err?.error || `Failed to remove member (${response.status})`)
        }
    },
}
