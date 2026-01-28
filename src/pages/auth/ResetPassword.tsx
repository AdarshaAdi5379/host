import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, useParams } from 'react-router-dom'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { PasswordStrength } from '@/components/auth/PasswordStrength'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { resetPasswordSchema } from '@/lib/authValidation'
import { useToast } from '@/components/ui/toast'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import type { ResetPasswordData } from '@/types/auth'

export function ResetPassword() {
    const navigate = useNavigate()
    const { token } = useParams<{ token: string }>()
    const { addToast } = useToast()
    const [isLoading, setIsLoading] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)

    const {
        register,
        handleSubmit,
        watch,
        formState: { errors },
    } = useForm<ResetPasswordData>({
        resolver: zodResolver(resetPasswordSchema),
        defaultValues: {
            token: token || '',
        },
    })

    const password = watch('password', '')

    const onSubmit = async (data: ResetPasswordData) => {
        setIsLoading(true)
        try {
            // Mock API call - replace with real API
            await new Promise((resolve) => setTimeout(resolve, 1500))

            addToast({
                title: 'Password Reset Successful',
                description: 'You can now sign in with your new password',
                variant: 'success',
            })
            navigate('/login')
        } catch (err) {
            addToast({
                title: 'Reset Failed',
                description: 'Invalid or expired reset token',
                variant: 'error',
            })
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <AuthLayout title="Reset Password" subtitle="Create a new password for your account">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {/* New Password */}
                <div>
                    <label htmlFor="password" className="block text-sm font-medium mb-2">
                        New Password
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
                        Confirm New Password
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

                <Button
                    type="submit"
                    variant="primary"
                    className="w-full"
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Resetting password...
                        </>
                    ) : (
                        'Reset Password'
                    )}
                </Button>
            </form>
        </AuthLayout>
    )
}
