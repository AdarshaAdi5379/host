import { z } from 'zod'

// Email validation
export const emailSchema = z
    .string()
    .email('Invalid email address')
    .min(1, 'Email is required')

// Password validation with strength requirements
export const passwordSchema = z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character')

// Name validation
export const nameSchema = z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name must be less than 50 characters')

// Login schema
export const loginSchema = z.object({
    email: emailSchema,
    password: z.string().min(1, 'Password is required'),
    rememberMe: z.boolean().optional(),
})

// Register schema
export const registerSchema = z
    .object({
        name: nameSchema,
        email: emailSchema,
        password: passwordSchema,
        confirmPassword: z.string(),
        acceptTerms: z.boolean().refine((val) => val === true, {
            message: 'You must accept the terms and conditions',
        }),
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: "Passwords don't match",
        path: ['confirmPassword'],
    })

// Forgot password schema
export const forgotPasswordSchema = z.object({
    email: emailSchema,
})

// Reset password schema
export const resetPasswordSchema = z
    .object({
        token: z.string().min(1, 'Invalid reset token'),
        password: passwordSchema,
        confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: "Passwords don't match",
        path: ['confirmPassword'],
    })

// MFA verification schema
export const mfaVerificationSchema = z.object({
    code: z.string().length(6, 'Code must be 6 digits').regex(/^\d+$/, 'Code must be numeric'),
    trustDevice: z.boolean().optional(),
})

// Password strength calculator
export function calculatePasswordStrength(password: string): {
    score: number
    label: 'weak' | 'medium' | 'strong' | 'very-strong'
    feedback: string[]
} {
    let score = 0
    const feedback: string[] = []

    // Length check
    if (password.length >= 8) score += 1
    else feedback.push('Use at least 8 characters')

    if (password.length >= 12) score += 1

    // Character variety
    if (/[a-z]/.test(password)) score += 1
    else feedback.push('Add lowercase letters')

    if (/[A-Z]/.test(password)) score += 1
    else feedback.push('Add uppercase letters')

    if (/[0-9]/.test(password)) score += 1
    else feedback.push('Add numbers')

    if (/[^A-Za-z0-9]/.test(password)) score += 1
    else feedback.push('Add special characters')

    // Determine label
    let label: 'weak' | 'medium' | 'strong' | 'very-strong'
    if (score <= 2) label = 'weak'
    else if (score <= 4) label = 'medium'
    else if (score <= 5) label = 'strong'
    else label = 'very-strong'

    return { score, label, feedback }
}

// Check password requirements
export function checkPasswordRequirements(password: string) {
    return {
        minLength: password.length >= 8,
        hasUppercase: /[A-Z]/.test(password),
        hasLowercase: /[a-z]/.test(password),
        hasNumber: /[0-9]/.test(password),
        hasSpecial: /[^A-Za-z0-9]/.test(password),
    }
}
