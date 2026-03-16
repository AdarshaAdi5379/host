import { API_BASE_URL } from './config'
import type { Role } from '@/types/auth'

const API_BASE = `${API_BASE_URL}/api/auth`

export const authAPI = {
    // Password login
    login: async (email: string, password: string) => {
        const response = await fetch(`${API_BASE}/login/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        })
        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.non_field_errors?.[0] || 'Login failed')
        }
        return response.json()  // Returns { key: 'token', user: {...} }
    },

    // Password registration
    register: async (email: string, password1: string, password2: string) => {
        const response = await fetch(`${API_BASE}/register/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password1, password2 }),
        })
        if (!response.ok) {
            const error = await response.json()
            const errorMessage =
                error.email?.[0] ||
                error.password1?.[0] ||
                error.password2?.[0] ||
                error.non_field_errors?.[0] ||
                error.username?.[0] ||
                error.detail ||
                'Registration failed'
            throw new Error(errorMessage)
        }
        return response.json()
    },

    // Google OAuth — implicit flow
    // Sends access_token + id_token obtained directly from Google's implicit flow.
    // django-allauth's Google adapter validates the id_token and returns a Knox token.
    googleLogin: async (accessToken: string, idToken: string) => {
        const response = await fetch(`${API_BASE}/google/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ access_token: accessToken, id_token: idToken }),
        })
        if (!response.ok) {
            let errorMessage = 'Google login failed'
            try {
                const error = await response.json()
                errorMessage = error.non_field_errors?.[0] || error.detail || errorMessage
            } catch (_) { /* response was not JSON */ }
            throw new Error(errorMessage)
        }
        return response.json()
    },

    // Logout
    logout: async (token: string) => {
        await fetch(`${API_BASE}/logout/`, {
            method: 'POST',
            headers: { 'Authorization': `Token ${token}` },
        })
    },

    // Get user profile
    getUser: async (token: string) => {
        const response = await fetch(`${API_BASE}/user/`, {
            headers: { 'Authorization': `Token ${token}` },
        })
        if (!response.ok) {
            throw new Error('Failed to fetch user')
        }
        return response.json()
    },

    // Get full user profile with RBAC
    me: async (token: string) => {
        // We use the profile/me endpoint to get full details including role
        const response = await fetch(`${API_BASE_URL}/api/profile/me/`, {
            headers: { 'Authorization': `Token ${token}` },
        })
        if (!response.ok) {
            throw new Error('Failed to fetch user profile')
        }
        const data = await response.json()
        // Map the profile data to our User interface.
        // The backend returns { user: { id, username, email, first_name, last_name, date_joined },
        //                        platform_role, project_quota, email_notifications, ... }
        // We must map snake_case backend fields → camelCase User interface fields.
        const u = data.user || {}
        const platformRole = (data.platform_role === 'super_admin' ? 'super_admin' : 'user') as 'super_admin' | 'user'
        const role: Role = platformRole === 'super_admin' ? 'owner' : 'user'
        const fullName = [u.first_name, u.last_name].filter(Boolean).join(' ')
        return {
            id: String(u.id ?? ''),
            email: u.email ?? '',
            name: fullName || u.username || u.email?.split('@')[0] || '',
            role,
            platform_role: platformRole,
            project_quota: data.project_quota,
            email_notifications: data.email_notifications,
            // The profile endpoint does not expose these fields; default to safe values.
            // They will be refreshed if the user re-authenticates.
            emailVerified: true,
            mfaEnabled: false,
            createdAt: u.date_joined ?? new Date().toISOString(),
        }
    },
}
