import { z } from 'zod'

// GST validation for India (15 characters)
// Format: 22AAAAA0000A1Z5
export const gstSchema = z
    .string()
    .regex(
        /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
        'Invalid GST format. Expected format: 22AAAAA0000A1Z5'
    )

// VAT validation for EU (Country code + alphanumeric)
export const vatSchema = z
    .string()
    .regex(/^[A-Z]{2}[0-9A-Z]{2,12}$/, 'Invalid VAT format. Expected format: GB123456789')

// EIN validation for US (XX-XXXXXXX)
export const einSchema = z
    .string()
    .regex(/^[0-9]{2}-[0-9]{7}$/, 'Invalid EIN format. Expected format: 12-3456789')

// Generic tax ID schema
export const taxIdSchema = z.string().min(5, 'Tax ID must be at least 5 characters')

// Card number validation using Luhn algorithm
export function validateCardNumber(cardNumber: string): boolean {
    const digits = cardNumber.replace(/\s/g, '')

    if (!/^\d{13,19}$/.test(digits)) {
        return false
    }

    let sum = 0
    let isEven = false

    for (let i = digits.length - 1; i >= 0; i--) {
        let digit = parseInt(digits[i], 10)

        if (isEven) {
            digit *= 2
            if (digit > 9) {
                digit -= 9
            }
        }

        sum += digit
        isEven = !isEven
    }

    return sum % 10 === 0
}

// Card expiration validation
export function validateCardExpiry(month: number, year: number): boolean {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1

    if (month < 1 || month > 12) {
        return false
    }

    if (year < currentYear) {
        return false
    }

    if (year === currentYear && month < currentMonth) {
        return false
    }

    return true
}

// CVV validation
export function validateCVV(cvv: string, cardType: string = 'visa'): boolean {
    const length = cardType === 'amex' ? 4 : 3
    return new RegExp(`^\\d{${length}}$`).test(cvv)
}

// Get card brand from number
export function getCardBrand(cardNumber: string): string {
    const digits = cardNumber.replace(/\s/g, '')

    if (/^4/.test(digits)) return 'Visa'
    if (/^5[1-5]/.test(digits)) return 'Mastercard'
    if (/^3[47]/.test(digits)) return 'American Express'
    if (/^6(?:011|5)/.test(digits)) return 'Discover'

    return 'Unknown'
}

// Mask card number
export function maskCardNumber(cardNumber: string): string {
    const digits = cardNumber.replace(/\s/g, '')
    const last4 = digits.slice(-4)
    return `**** **** **** ${last4}`
}
