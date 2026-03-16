import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useEffect, useState } from 'react'
import type { AuthState, User, LoginCredentials, RegisterData } from '@/types/auth'
import { authAPI } from '@/lib/api/auth'

function normalizeToken(token?: string | null): string | null {
    if (!token) {
        return null
    }
    const cleaned = token.replace(/^Token\s+/i, '').trim()
    return cleaned || null
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
                    const response = await authAPI.login(credentials.email, credentials.password)
                    // Fetch full user profile including RBAC info
                    const userProfile = await authAPI.me(response.key)
                    set({
                        user: userProfile,
                        token: normalizeToken(response.key),
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
                        token: normalizeToken(response.key),
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
                console.warn('[authStore] logout called', new Error().stack?.split('\n').slice(1,4).join(' | '))
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
                    // Only clear the session if the server explicitly rejected the token (401).
                    // For network errors or 5xx, keep the session alive so the user can retry.
                    if (error instanceof Error && error.message.includes('401')) {
                        get().clearSession()
                    }
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

            clearSession: () => {
                console.warn('[authStore] clearSession called', new Error().stack?.split('\n').slice(1,4).join(' | '))
                set({
                    user: null,
                    token: null,
                    isAuthenticated: false,
                    error: null,
                })
            },
        }),
        {
            name: 'auth-storage',
            version: 2,  // bump to force migration of stale user objects
            partialize: (state) => ({
                user: state.user,
                token: state.token,
                isAuthenticated: state.isAuthenticated,
            }),
            // When the stored version is older than current, wipe auth state so
            // the user gets a clean login with the correct user object shape.
            migrate: (persistedState, storedVersion) => {
                if (storedVersion < 2) {
                    // Pre-v2: user objects may be missing role/name (from old me() mapping
                    // or from GoogleCallback using getUser() instead of me()).
                    return { user: null, token: null, isAuthenticated: false }
                }
                const state = persistedState as { user: User | null; token: string | null; isAuthenticated: boolean }
                return state
            },
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
    const [hasHydrated, setHasHydrated] = useState(false)

    useEffect(() => {
        if (useAuthStore.persist.hasHydrated()) {
            const { token, isAuthenticated } = useAuthStore.getState()
            console.log('[hydration] already hydrated on mount | token=', token ? token.slice(0,8)+'...' : 'NULL', 'isAuth=', isAuthenticated)
            setHasHydrated(true)
            return
        }
        const unsub = useAuthStore.persist.onFinishHydration(() => {
            const { token, isAuthenticated } = useAuthStore.getState()
            console.log('[hydration] onFinishHydration fired | token=', token ? token.slice(0,8)+'...' : 'NULL', 'isAuth=', isAuthenticated)
            setHasHydrated(true)
        })
        if (useAuthStore.persist.hasHydrated()) {
            setHasHydrated(true)
        }
        return unsub
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    return hasHydrated
}
