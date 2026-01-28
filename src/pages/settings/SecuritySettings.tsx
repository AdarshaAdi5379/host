import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { passwordChangeSchema } from '@/lib/settingsValidation'
import { useToast } from '@/components/ui/toast'
import { useAuthStore } from '@/store/authStore'
import { Eye, EyeOff, Shield, Key, Lock, CheckCircle } from 'lucide-react'
import type { z } from 'zod'

type PasswordChangeFormData = z.infer<typeof passwordChangeSchema>

export function SecuritySettings() {
    const { user } = useAuthStore()
    const { addToast } = useToast()
    const [showCurrentPassword, setShowCurrentPassword] = useState(false)
    const [showNewPassword, setShowNewPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [mfaEnabled, setMfaEnabled] = useState(user?.mfaEnabled || false)

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<PasswordChangeFormData>({
        resolver: zodResolver(passwordChangeSchema),
    })

    const onPasswordChange = async (data: PasswordChangeFormData) => {
        try {
            // Mock API call
            await new Promise((resolve) => setTimeout(resolve, 1000))

            addToast({
                title: 'Password Changed',
                description: 'Your password has been updated successfully',
                variant: 'success',
            })

            reset()
        } catch (error) {
            addToast({
                title: 'Error',
                description: 'Failed to change password',
                variant: 'error',
            })
        }
    }

    const handleToggleMFA = () => {
        if (!mfaEnabled) {
            // Show MFA setup modal
            addToast({
                title: 'MFA Setup',
                description: 'MFA setup wizard would open here',
                variant: 'info',
            })
        } else {
            setMfaEnabled(false)
            addToast({
                title: 'MFA Disabled',
                description: 'Two-factor authentication has been disabled',
                variant: 'warning',
            })
        }
    }

    return (
        <div className="space-y-6">
            {/* Security Score */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                        <Shield className="w-5 h-5" />
                        <span>Security Score</span>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <p className="text-3xl font-bold text-brand-purple">85/100</p>
                            <p className="text-sm text-gray-600">Good security posture</p>
                        </div>
                        <div className="text-right">
                            <Badge variant="success">Strong</Badge>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center space-x-2 text-sm">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <span>Password strength: Strong</span>
                        </div>
                        <div className="flex items-center space-x-2 text-sm">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <span>Email verified</span>
                        </div>
                        <div className="flex items-center space-x-2 text-sm">
                            {mfaEnabled ? (
                                <CheckCircle className="w-4 h-4 text-green-600" />
                            ) : (
                                <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                            )}
                            <span>Two-factor authentication {mfaEnabled ? 'enabled' : 'disabled'}</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Password Change */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                        <Key className="w-5 h-5" />
                        <span>Change Password</span>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit(onPasswordChange)} className="space-y-4">
                        <div>
                            <label htmlFor="currentPassword" className="block text-sm font-medium mb-2">
                                Current Password
                            </label>
                            <div className="relative">
                                <Input
                                    id="currentPassword"
                                    type={showCurrentPassword ? 'text' : 'password'}
                                    {...register('currentPassword')}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500"
                                >
                                    {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                            {errors.currentPassword && (
                                <p className="text-sm text-red-600 mt-1">{errors.currentPassword.message}</p>
                            )}
                        </div>

                        <div>
                            <label htmlFor="newPassword" className="block text-sm font-medium mb-2">
                                New Password
                            </label>
                            <div className="relative">
                                <Input
                                    id="newPassword"
                                    type={showNewPassword ? 'text' : 'password'}
                                    {...register('newPassword')}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowNewPassword(!showNewPassword)}
                                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500"
                                >
                                    {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                            {errors.newPassword && (
                                <p className="text-sm text-red-600 mt-1">{errors.newPassword.message}</p>
                            )}
                        </div>

                        <div>
                            <label htmlFor="confirmPassword" className="block text-sm font-medium mb-2">
                                Confirm New Password
                            </label>
                            <div className="relative">
                                <Input
                                    id="confirmPassword"
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    {...register('confirmPassword')}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500"
                                >
                                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                            {errors.confirmPassword && (
                                <p className="text-sm text-red-600 mt-1">{errors.confirmPassword.message}</p>
                            )}
                        </div>

                        <Button type="submit" variant="primary">
                            Update Password
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {/* Two-Factor Authentication */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                        <Lock className="w-5 h-5" />
                        <span>Two-Factor Authentication</span>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <p className="font-medium">
                                {mfaEnabled ? 'Enabled' : 'Disabled'}
                            </p>
                            <p className="text-sm text-gray-600">
                                Add an extra layer of security to your account
                            </p>
                        </div>
                        <Badge variant={mfaEnabled ? 'success' : 'default'}>
                            {mfaEnabled ? 'Active' : 'Inactive'}
                        </Badge>
                    </div>
                    <Button
                        variant={mfaEnabled ? 'outline' : 'primary'}
                        onClick={handleToggleMFA}
                    >
                        {mfaEnabled ? 'Disable 2FA' : 'Enable 2FA'}
                    </Button>
                </CardContent>
            </Card>

            {/* Social Connections */}
            <Card>
                <CardHeader>
                    <CardTitle>Social Connections</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-white border border-gray-200 rounded-lg flex items-center justify-center">
                                <svg className="w-6 h-6" viewBox="0 0 24 24">
                                    <path
                                        fill="currentColor"
                                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                    />
                                </svg>
                            </div>
                            <div>
                                <p className="font-medium">Google</p>
                                <p className="text-sm text-gray-600">Not connected</p>
                            </div>
                        </div>
                        <Button variant="outline" size="sm">
                            Connect
                        </Button>
                    </div>

                    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-gray-900 rounded-lg flex items-center justify-center">
                                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                                </svg>
                            </div>
                            <div>
                                <p className="font-medium">GitHub</p>
                                <p className="text-sm text-gray-600">Not connected</p>
                            </div>
                        </div>
                        <Button variant="outline" size="sm">
                            Connect
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
