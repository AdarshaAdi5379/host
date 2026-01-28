import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface NotificationChannel {
    enabled: boolean
    email: boolean
    sms: boolean
    push: boolean
}

export interface NotificationPreferences {
    securityAlerts: NotificationChannel
    billing: NotificationChannel
    systemUpdates: NotificationChannel
    marketing: NotificationChannel
}

export interface LocalizationSettings {
    timezone: string
    language: 'en' | 'kn' | 'hi' | 'es' | 'fr'
    currency: 'USD' | 'INR' | 'EUR' | 'GBP'
    dateFormat: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD'
}

interface SettingsState {
    notifications: NotificationPreferences
    localization: LocalizationSettings
    hasUnsavedChanges: boolean
    updateNotifications: (notifications: Partial<NotificationPreferences>) => void
    updateLocalization: (localization: Partial<LocalizationSettings>) => void
    setUnsavedChanges: (hasChanges: boolean) => void
    resetChanges: () => void
}

const defaultNotifications: NotificationPreferences = {
    securityAlerts: {
        enabled: true,
        email: true,
        sms: false,
        push: true,
    },
    billing: {
        enabled: true,
        email: true,
        sms: false,
        push: false,
    },
    systemUpdates: {
        enabled: true,
        email: true,
        sms: false,
        push: false,
    },
    marketing: {
        enabled: false,
        email: false,
        sms: false,
        push: false,
    },
}

const defaultLocalization: LocalizationSettings = {
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: 'en',
    currency: 'USD',
    dateFormat: 'MM/DD/YYYY',
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            notifications: defaultNotifications,
            localization: defaultLocalization,
            hasUnsavedChanges: false,

            updateNotifications: (notifications) =>
                set((state) => ({
                    notifications: { ...state.notifications, ...notifications },
                    hasUnsavedChanges: true,
                })),

            updateLocalization: (localization) =>
                set((state) => ({
                    localization: { ...state.localization, ...localization },
                    hasUnsavedChanges: true,
                })),

            setUnsavedChanges: (hasChanges) =>
                set({ hasUnsavedChanges: hasChanges }),

            resetChanges: () =>
                set({
                    notifications: defaultNotifications,
                    localization: defaultLocalization,
                    hasUnsavedChanges: false,
                }),
        }),
        {
            name: 'settings-storage',
            partialize: (state) => ({
                notifications: state.notifications,
                localization: state.localization,
            }),
        }
    )
)
