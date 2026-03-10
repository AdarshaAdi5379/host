import { API_BASE_URL } from './config'

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

    // Google OAuth
    googleLogin: async (code: string) => {
        const response = await fetch(`${API_BASE}/google/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code }),
        })
        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.non_field_errors?.[0] || 'Google login failed')
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
        // Map the profile data to our User interface
        return {
            ...data.user,
            platform_role: data.platform_role,
            project_quota: data.project_quota,
            email_notifications: data.email_notifications
        }
    },
}
