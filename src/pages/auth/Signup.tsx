import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from 'react-router-dom'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { SocialLogin } from '@/components/auth/SocialLogin'
import { PasswordStrength } from '@/components/auth/PasswordStrength'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/store/authStore'
import { registerSchema } from '@/lib/authValidation'
import { useToast } from '@/components/ui/toast'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import type { RegisterData } from '@/types/auth'

export function Signup() {
    const navigate = useNavigate()
    const { register: registerUser, isLoading } = useAuthStore()
    const { addToast } = useToast()
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)

    const {
        register,
        handleSubmit,
        watch,
        formState: { errors },
    } = useForm<RegisterData>({
        resolver: zodResolver(registerSchema),
    })

    const password = watch('password', '')

    const onSubmit = async (data: RegisterData) => {
        try {
            await registerUser(data)
            addToast({
                title: 'Account Created!',
                description: 'Welcome to Hostinger',
                variant: 'success',
            })
            navigate('/onboarding')
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Registration failed. Please try again.'
            addToast({
                title: 'Registration Failed',
                description: message,
                variant: 'error',
            })
        }
    }

    return (
        <AuthLayout title="Create Account" subtitle="Get started with Hostinger">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {/* Social Login */}
                <SocialLogin />

                {/* Name */}
                <div>
                    <label htmlFor="name" className="block text-sm font-medium mb-2">
                        Full Name
                    </label>
                    <Input
                        id="name"
                        type="text"
                        placeholder="John Doe"
                        {...register('name')}
                        disabled={isLoading}
                    />
                    {errors.name && (
                        <p className="text-sm text-red-600 mt-1">{errors.name.message}</p>
                    )}
                </div>

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
                        disabled={isLoading}
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
                            placeholder="Create a strong password"
                            {...register('password')}
                            disabled={isLoading}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                            disabled={isLoading}
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

                {/* Password Strength */}
                <PasswordStrength password={password} />

                {/* Confirm Password */}
                <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium mb-2">
                        Confirm Password
                    </label>
                    <div className="relative">
                        <Input
                            id="confirmPassword"
                            type={showConfirmPassword ? 'text' : 'password'}
                            placeholder="Confirm your password"
                            {...register('confirmPassword')}
                            disabled={isLoading}
                        />
                        <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                            disabled={isLoading}
                        >
                            {showConfirmPassword ? (
                                <EyeOff className="w-5 h-5" />
                            ) : (
                                <Eye className="w-5 h-5" />
                            )}
                        </button>
                    </div>
                    {errors.confirmPassword && (
                        <p className="text-sm text-red-600 mt-1">{errors.confirmPassword.message}</p>
                    )}
                </div>

                {/* Terms & Conditions */}
                <div>
                    <label className="flex items-start space-x-2">
                        <input
                            type="checkbox"
                            {...register('acceptTerms')}
                            className="mt-1 rounded border-gray-300 text-brand-purple focus:ring-brand-purple"
                            disabled={isLoading}
                        />
                        <span className="text-sm text-gray-700">
                            I agree to the{' '}
                            <Link to="/terms" className="text-brand-purple hover:underline">
                                Terms of Service
                            </Link>{' '}
                            and{' '}
                            <Link to="/privacy" className="text-brand-purple hover:underline">
                                Privacy Policy
                            </Link>
                        </span>
                    </label>
                    {errors.acceptTerms && (
                        <p className="text-sm text-red-600 mt-1">{errors.acceptTerms.message}</p>
                    )}
                </div>

                {/* Submit Button */}
                <Button
                    type="submit"
                    variant="primary"
                    className="w-full"
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Creating account...
                        </>
                    ) : (
                        'Create Account'
                    )}
                </Button>

                {/* Login Link */}
                <p className="text-center text-sm text-gray-600">
                    Already have an account?{' '}
                    <Link to="/login" className="text-brand-purple font-medium hover:underline">
                        Sign in
                    </Link>
                </p>
            </form>
        </AuthLayout>
    )
}
