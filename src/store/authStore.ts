import { create } from 'zustand'

interface AuthState {
    isAuthenticated: boolean
    user: {
        name: string
        email: string
        plan: string
    } | null
    login: (email: string, password: string) => void
    logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
    isAuthenticated: true, // Set to true for development
    user: {
        name: 'John Doe',
        email: 'john@example.com',
        plan: 'Premium Plan',
    },
    login: (email: string, password: string) => {
        // Mock login - in production, this would call an API
        set({
            isAuthenticated: true,
            user: {
                name: 'John Doe',
                email,
                plan: 'Premium Plan',
            },
        })
    },
    logout: () => {
        set({ isAuthenticated: false, user: null })
    },
}))
