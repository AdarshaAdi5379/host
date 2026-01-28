import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from 'react-router-dom'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { SocialLogin } from '@/components/auth/SocialLogin'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/store/authStore'
import { loginSchema } from '@/lib/authValidation'
import { useRateLimit } from '@/hooks/useRateLimit'
import { useToast } from '@/components/ui/toast'
import { Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react'
import type { LoginCredentials } from '@/types/auth'

export function Login() {
    const navigate = useNavigate()
    const { login, isLoading, error, clearError } = useAuthStore()
    const { addToast } = useToast()
    const { isLocked, remainingTime, recordAttempt, reset } = useRateLimit()
    const [showPassword, setShowPassword] = useState(false)

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<LoginCredentials>({
        resolver: zodResolver(loginSchema),
    })

    const onSubmit = async (data: LoginCredentials) => {
        if (isLocked) {
            addToast({
                title: 'Too Many Attempts',
                description: `Please wait ${remainingTime} seconds before trying again`,
                variant: 'error',
            })
            return
        }

        try {
            clearError()
            await login(data)
            reset()
            addToast({
                title: 'Welcome Back!',
                description: 'You have successfully logged in',
                variant: 'success',
            })
            navigate('/dashboard')
        } catch (err) {
            recordAttempt()
            addToast({
                title: 'Login Failed',
                description: error || 'Invalid email or password',
                variant: 'error',
            })
        }
    }

    return (
        <AuthLayout title="Welcome Back" subtitle="Sign in to your account">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {/* Social Login */}
                <SocialLogin />

                {/* Email */}
                <div>
                    <label htmlFor="email" className="block text-sm font-medium mb-2">
                        Email Address
                    </label>
                    <Input
                        id="email"
                        type="email"
                        placeholder="you@example.com"
                        {...register('email')}
                        disabled={isLoading || isLocked}
                    />
                    {errors.email && (
                        <p className="text-sm text-red-600 mt-1">{errors.email.message}</p>
                    )}
                </div>

                {/* Password */}
                <div>
                    <label htmlFor="password" className="block text-sm font-medium mb-2">
                        Password
                    </label>
                    <div className="relative">
                        <Input
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Enter your password"
                            {...register('password')}
                            disabled={isLoading || isLocked}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                            disabled={isLoading || isLocked}
                        >
                            {showPassword ? (
                                <EyeOff className="w-5 h-5" />
                            ) : (
                                <Eye className="w-5 h-5" />
                            )}
                        </button>
                    </div>
                    {errors.password && (
                        <p className="text-sm text-red-600 mt-1">{errors.password.message}</p>
                    )}
                </div>

                {/* Remember Me & Forgot Password */}
                <div className="flex items-center justify-between">
                    <label className="flex items-center space-x-2">
                        <input
                            type="checkbox"
                            {...register('rememberMe')}
                            className="rounded border-gray-300 text-brand-purple focus:ring-brand-purple"
                            disabled={isLoading || isLocked}
                        />
                        <span className="text-sm text-gray-700">Keep me logged in</span>
                    </label>
                    <Link
                        to="/forgot-password"
                        className="text-sm text-brand-purple hover:underline"
                    >
                        Forgot password?
                    </Link>
                </div>

                {/* Rate Limit Warning */}
                {isLocked && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-2">
                        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-medium text-red-900">Account Locked</p>
                            <p className="text-sm text-red-700">
                                Too many failed attempts. Please wait {remainingTime} seconds.
                            </p>
                        </div>
                    </div>
                )}

                {/* Submit Button */}
                <Button
                    type="submit"
                    variant="primary"
                    className="w-full"
                    disabled={isLoading || isLocked}
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Signing in...
                        </>
                    ) : (
                        'Sign In'
                    )}
                </Button>

                {/* Sign Up Link */}
                <p className="text-center text-sm text-gray-600">
                    Don't have an account?{' '}
                    <Link to="/signup" className="text-brand-purple font-medium hover:underline">
                        Sign up
                    </Link>
                </p>
            </form>
        </AuthLayout>
    )
}
