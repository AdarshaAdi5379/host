import type { ReactNode } from 'react'

interface AuthLayoutProps {
    children: ReactNode
    title?: string
    subtitle?: string
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-blue-50 p-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-brand-purple mb-2">Hostinger</h1>
                    {title && <h2 className="text-2xl font-bold text-brand-navy">{title}</h2>}
                    {subtitle && <p className="text-gray-600 mt-2">{subtitle}</p>}
                </div>

                {/* Card */}
                <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
                    {children}
                </div>

                {/* Footer */}
                <p className="text-center text-sm text-gray-600 mt-6">
                    © 2026 Hostinger. All rights reserved.
                </p>
            </div>
        </div>
    )
}
