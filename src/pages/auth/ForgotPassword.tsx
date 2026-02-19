import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from 'react-router-dom'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { forgotPasswordSchema } from '@/lib/authValidation'
import { useToast } from '@/components/ui/toast'
import { Loader2, CheckCircle, Mail } from 'lucide-react'
import type { ForgotPasswordData } from '@/types/auth'

export function ForgotPassword() {
    const { addToast } = useToast()
    const [isLoading, setIsLoading] = useState(false)
    const [emailSent, setEmailSent] = useState(false)

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<ForgotPasswordData>({
        resolver: zodResolver(forgotPasswordSchema),
    })

    const onSubmit = async () => {
        setIsLoading(true)
        try {
            // Mock API call - replace with real API
            await new Promise((resolve) => setTimeout(resolve, 1500))

            setEmailSent(true)
            addToast({
                title: 'Email Sent',
                description: 'Check your inbox for password reset instructions',
                variant: 'success',
            })
        } catch (err) {
            addToast({
                title: 'Error',
                description: 'Failed to send reset email. Please try again.',
                variant: 'error',
            })
        } finally {
            setIsLoading(false)
        }
    }

    if (emailSent) {
        return (
            <AuthLayout title="Check Your Email">
                <div className="text-center space-y-6">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                        <CheckCircle className="w-8 h-8 text-green-600" />
                    </div>

                    <div>
                        <h3 className="text-lg font-semibold mb-2">Email Sent Successfully</h3>
                        <p className="text-gray-600">
                            We've sent password reset instructions to your email address.
                            Please check your inbox and follow the link to reset your password.
                        </p>
                    </div>

                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-start space-x-3">
                            <Mail className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                            <div className="text-left">
                                <p className="text-sm font-medium text-blue-900">Didn't receive the email?</p>
                                <p className="text-sm text-blue-700 mt-1">
                                    Check your spam folder or{' '}
                                    <button
                                        onClick={() => setEmailSent(false)}
                                        className="text-brand-purple font-medium hover:underline"
                                    >
                                        try again
                                    </button>
                                </p>
                            </div>
                        </div>
                    </div>

                    <Link to="/login">
                        <Button variant="outline" className="w-full">
                            Back to Login
                        </Button>
                    </Link>
                </div>
            </AuthLayout>
        )
    }

    return (
        <AuthLayout
            title="Forgot Password"
            subtitle="Enter your email to reset your password"
        >
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div>
                    <label htmlFor="email" className="block text-sm font-medium mb-2">
                        Email Address
                    </label>
                    <Input
                        id="email"
                        type="email"
                        placeholder="you@example.com"
                        {...register('email')}
                        disabled={isLoading}
                    />
                    {errors.email && (
                        <p className="text-sm text-red-600 mt-1">{errors.email.message}</p>
                    )}
                </div>

                <Button
                    type="submit"
                    variant="primary"
                    className="w-full"
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Sending...
                        </>
                    ) : (
                        'Send Reset Link'
                    )}
                </Button>

                <p className="text-center text-sm text-gray-600">
                    Remember your password?{' '}
                    <Link to="/login" className="text-brand-purple font-medium hover:underline">
                        Sign in
                    </Link>
                </p>
            </form>
        </AuthLayout>
    )
}
