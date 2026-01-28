import { z } from 'zod'

// Profile update schema
export const profileUpdateSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(50, 'Name must be less than 50 characters'),
    title: z.string().max(100, 'Title must be less than 100 characters').optional(),
    bio: z.string().max(500, 'Bio must be less than 500 characters').optional(),
    email: z.string().email('Invalid email address'),
    phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number').optional(),
})

// Password change schema
export const passwordChangeSchema = z
    .object({
        currentPassword: z.string().min(1, 'Current password is required'),
        newPassword: z
            .string()
            .min(8, 'Password must be at least 8 characters')
            .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
            .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
            .regex(/[0-9]/, 'Password must contain at least one number')
            .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
        confirmPassword: z.string(),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
        message: "Passwords don't match",
        path: ['confirmPassword'],
    })
    .refine((data) => data.currentPassword !== data.newPassword, {
        message: 'New password must be different from current password',
        path: ['newPassword'],
    })

// Localization settings schema
export const localizationSchema = z.object({
    timezone: z.string(),
    language: z.enum(['en', 'kn', 'hi', 'es', 'fr']),
    currency: z.enum(['USD', 'INR', 'EUR', 'GBP']),
    dateFormat: z.enum(['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD']),
})

// Notification preferences schema
export const notificationPreferencesSchema = z.object({
    securityAlerts: z.object({
        enabled: z.boolean(),
        email: z.boolean(),
        sms: z.boolean(),
        push: z.boolean(),
    }),
    billing: z.object({
        enabled: z.boolean(),
        email: z.boolean(),
        sms: z.boolean(),
        push: z.boolean(),
    }),
    systemUpdates: z.object({
        enabled: z.boolean(),
        email: z.boolean(),
        sms: z.boolean(),
        push: z.boolean(),
    }),
    marketing: z.object({
        enabled: z.boolean(),
        email: z.boolean(),
        sms: z.boolean(),
        push: z.boolean(),
    }),
})

// Delete account confirmation schema
export const deleteAccountSchema = z.object({
    confirmation: z.string().refine((val) => val === 'DELETE', {
        message: 'You must type DELETE to confirm',
    }),
})
