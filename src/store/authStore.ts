import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AuthState, User, LoginCredentials, RegisterData } from '@/types/auth'

// Mock API calls - replace with real API
const mockLogin = async (credentials: LoginCredentials): Promise<{ user: User; token: string }> => {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Mock validation
    if (credentials.email === 'demo@example.com' && credentials.password === 'Demo@123') {
        return {
            user: {
                id: '1',
                email: credentials.email,
                name: 'Demo User',
                role: 'owner',
                avatar: undefined,
                emailVerified: true,
                mfaEnabled: false,
                createdAt: new Date().toISOString(),
                lastLoginAt: new Date().toISOString(),
                lastLoginLocation: 'Bangalore, India',
            },
            token: 'mock-jwt-token-' + Date.now(),
        }
    }

    throw new Error('Invalid credentials')
}

const mockRegister = async (data: RegisterData): Promise<{ user: User; token: string }> => {
    await new Promise((resolve) => setTimeout(resolve, 1000))

    return {
        user: {
            id: Date.now().toString(),
            email: data.email,
            name: data.name,
            role: 'owner',
            emailVerified: false,
            mfaEnabled: false,
            createdAt: new Date().toISOString(),
        },
        token: 'mock-jwt-token-' + Date.now(),
    }
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,

            login: async (credentials: LoginCredentials) => {
                set({ isLoading: true, error: null })
                try {
                    const { user, token } = await mockLogin(credentials)
                    set({
                        user,
                        token,
                        isAuthenticated: true,
                        isLoading: false,
                        error: null,
                    })
                } catch (error) {
                    set({
                        error: error instanceof Error ? error.message : 'Login failed',
                        isLoading: false,
                    })
                    throw error
                }
            },

            register: async (data: RegisterData) => {
                set({ isLoading: true, error: null })
                try {
                    const { user, token } = await mockRegister(data)
                    set({
                        user,
                        token,
                        isAuthenticated: true,
                        isLoading: false,
                        error: null,
                    })
                } catch (error) {
                    set({
                        error: error instanceof Error ? error.message : 'Registration failed',
                        isLoading: false,
                    })
                    throw error
                }
            },

            logout: () => {
                set({
                    user: null,
                    token: null,
                    isAuthenticated: false,
                    error: null,
                })
            },

            logoutEverywhere: async () => {
                // In a real app, this would call an API to invalidate all tokens
                await new Promise((resolve) => setTimeout(resolve, 500))
                get().logout()
            },

            refreshToken: async () => {
                const { token } = get()
                if (!token) return

                try {
                    // Mock token refresh - replace with real API call
                    await new Promise((resolve) => setTimeout(resolve, 500))
                    const newToken = 'refreshed-token-' + Date.now()
                    set({ token: newToken })
                } catch (error) {
                    // If refresh fails, logout
                    get().logout()
                }
            },

            updateUser: (userData: Partial<User>) => {
                set((state) => ({
                    user: state.user ? { ...state.user, ...userData } : null,
                }))
            },

            clearError: () => {
                set({ error: null })
            },
        }),
        {
            name: 'auth-storage',
            partialize: (state) => ({
                user: state.user,
                token: state.token,
                isAuthenticated: state.isAuthenticated,
            }),
        }
    )
)

// Token refresh interval (5 minutes before expiry)
let refreshInterval: NodeJS.Timeout | null = null

export function startTokenRefresh() {
    if (refreshInterval) return

    // Refresh token every 50 minutes (assuming 1 hour expiry)
    refreshInterval = setInterval(() => {
        const { isAuthenticated, refreshToken } = useAuthStore.getState()
        if (isAuthenticated) {
            refreshToken()
        }
    }, 50 * 60 * 1000)
}

export function stopTokenRefresh() {
    if (refreshInterval) {
        clearInterval(refreshInterval)
        refreshInterval = null
    }
}
