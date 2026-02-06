import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AuthState, User, LoginCredentials, RegisterData } from '@/types/auth'
import { authAPI } from '@/lib/api/auth'


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
                    const response = await authAPI.login(credentials.email, credentials.password)
                    // Fetch user profile with the token
                    const userProfile = await authAPI.getUser(response.key)
                    set({
                        user: userProfile,
                        token: response.key,
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
                    const response = await authAPI.register(
                        data.email,
                        data.password,  // password1
                        data.confirmPassword  // password2
                    )
                    // Fetch user profile with the token
                    const userProfile = await authAPI.getUser(response.key)
                    set({
                        user: userProfile,
                        token: response.key,
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

            logout: async () => {
                const { token } = get()
                if (token) {
                    try {
                        await authAPI.logout(token)
                    } catch (error) {
                        console.error('Logout error:', error)
                    }
                }
                set({
                    user: null,
                    token: null,
                    isAuthenticated: false,
                    error: null,
                })
            },

            logoutEverywhere: async () => {
                // Knox automatically handles token invalidation on logout
                await get().logout()
            },

            refreshToken: async () => {
                const { token } = get()
                if (!token) return

                try {
                    // Knox tokens auto-refresh on use, so we just verify the token is still valid
                    await authAPI.getUser(token)
                } catch (error) {
                    // If token is invalid, logout
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
let refreshInterval: number | null = null

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
