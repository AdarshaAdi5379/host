const API_BASE = 'http://localhost:8000/api/auth'

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
    register: async (email: string, password1: string, password2: string, username?: string) => {
        const response = await fetch(`${API_BASE}/register/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password1, password2, username: username || email.split('@')[0] }),
        })
        if (!response.ok) {
            const error = await response.json()
            const errorMessage = error.email?.[0] || error.password1?.[0] || error.non_field_errors?.[0] || 'Registration failed'
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
}
