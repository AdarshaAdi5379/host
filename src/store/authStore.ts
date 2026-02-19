import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useEffect, useState } from 'react'
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
                    // Fetch full user profile including RBAC info
                    const userProfile = await authAPI.me(response.key)
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
                        data.password,
                        data.confirmPassword
                    )
                    // Fetch full user profile including RBAC info
                    const userProfile = await authAPI.me(response.key)
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

/**
 * Returns true once Zustand's persist middleware has finished
 * rehydrating the store from localStorage. Always use this to gate
 * authenticated API calls in useEffect, and in ProtectedRoute, to
 * avoid the 401 race condition where the token is null on first render.
 */
export function useHasHydrated() {
    const [hasHydrated, setHasHydrated] = useState(
        // Check synchronously first — if hydration already happened, no flash
        () => useAuthStore.persist.hasHydrated()
    )

    useEffect(() => {
        if (hasHydrated) return
        // Subscribe to the hydration finish event (Zustand v5+ API)
        const unsub = useAuthStore.persist.onFinishHydration(() => {
            setHasHydrated(true)
        })
        // Guard: hydration may have completed between useState init and this effect
        if (useAuthStore.persist.hasHydrated()) {
            setHasHydrated(true)
        }
        return unsub
    }, [hasHydrated])

    return hasHydrated
}

