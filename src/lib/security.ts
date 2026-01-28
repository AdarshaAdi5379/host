/**
 * Sanitize HTML to prevent XSS attacks
 */
export function sanitizeHtml(html: string): string {
    const div = document.createElement('div')
    div.textContent = html
    return div.innerHTML
}

/**
 * Escape special characters for safe display
 */
export function escapeHtml(text: string): string {
    const map: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '/': '&#x2F;',
    }
    return text.replace(/[&<>"'/]/g, (char) => map[char])
}

/**
 * Sanitize user input for safe storage and display
 */
export function sanitizeInput(input: string): string {
    return input.trim().replace(/[<>]/g, '')
}

/**
 * Validate and sanitize email
 */
export function sanitizeEmail(email: string): string {
    return email.toLowerCase().trim()
}

/**
 * Check if string contains potential XSS
 */
export function containsXSS(input: string): boolean {
    const xssPatterns = [
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        /javascript:/gi,
        /on\w+\s*=/gi,
        /<iframe/gi,
        /<object/gi,
        /<embed/gi,
    ]

    return xssPatterns.some((pattern) => pattern.test(input))
}

/**
 * Remove potentially dangerous characters from SQL-like inputs
 */
export function sanitizeSqlInput(input: string): string {
    return input.replace(/['";\\]/g, '')
}

/**
 * Generate a secure random token
 */
export function generateSecureToken(length: number = 32): string {
    const array = new Uint8Array(length)
    crypto.getRandomValues(array)
    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Hash a string using SHA-256 (for client-side fingerprinting, not passwords)
 */
export async function hashString(str: string): Promise<string> {
    const encoder = new TextEncoder()
    const data = encoder.encode(str)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Validate URL to prevent open redirect vulnerabilities
 */
export function isValidRedirectUrl(url: string, allowedDomains: string[]): boolean {
    try {
        const parsed = new URL(url, window.location.origin)

        // Only allow same origin or explicitly allowed domains
        if (parsed.origin === window.location.origin) {
            return true
        }

        return allowedDomains.some((domain) => parsed.hostname.endsWith(domain))
    } catch {
        return false
    }
}
