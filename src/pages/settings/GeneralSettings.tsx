import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { AvatarUpload } from '@/components/settings/AvatarUpload'
import { FloatingSaveBar } from '@/components/settings/FloatingSaveBar'
import { useAuthStore } from '@/store/authStore'
import { useSettingsStore } from '@/store/settingsStore'
import { profileUpdateSchema, localizationSchema } from '@/lib/settingsValidation'
import { useToast } from '@/components/ui/toast'
import { Badge } from '@/components/ui/badge'
import { Mail, Phone, Globe, Calendar } from 'lucide-react'
import type { z } from 'zod'

type ProfileFormData = z.infer<typeof profileUpdateSchema>
type LocalizationFormData = z.infer<typeof localizationSchema>

export function GeneralSettings() {
    const { user, updateUser } = useAuthStore()
    const { localization, updateLocalization, setUnsavedChanges } = useSettingsStore()
    const { addToast } = useToast()
    const [avatarFile, setAvatarFile] = useState<File | null>(null)

    const {
        register: registerProfile,
        handleSubmit: handleSubmitProfile,
        formState: { errors: profileErrors },
    } = useForm<ProfileFormData>({
        resolver: zodResolver(profileUpdateSchema),
        defaultValues: {
            name: user?.name || '',
            title: '',
            bio: '',
            email: user?.email || '',
            phone: '',
        },
    })

    const {
        register: registerLocalization,
        handleSubmit: handleSubmitLocalization,
        watch,
    } = useForm<LocalizationFormData>({
        resolver: zodResolver(localizationSchema),
        defaultValues: localization,
    })

    const bioValue = watch('bio' as any) || ''

    const handleSaveChanges = async () => {
        // Mock save - replace with real API call
        await new Promise((resolve) => setTimeout(resolve, 1000))

        addToast({
            title: 'Settings Saved',
            description: 'Your profile has been updated successfully',
            variant: 'success',
        })

        setUnsavedChanges(false)
    }

    const handleDiscardChanges = () => {
        setUnsavedChanges(false)
        addToast({
            title: 'Changes Discarded',
            description: 'Your changes have been discarded',
            variant: 'default',
        })
    }

    return (
        <div className="space-y-6">
            {/* Avatar Section */}
            <Card>
                <CardHeader>
                    <CardTitle>Profile Picture</CardTitle>
                </CardHeader>
                <CardContent>
                    <AvatarUpload
                        currentAvatar={user?.avatar}
                        onAvatarChange={(file) => {
                            setAvatarFile(file)
                            setUnsavedChanges(true)
                        }}
                    />
                </CardContent>
            </Card>

            {/* Personal Details */}
            <Card>
                <CardHeader>
                    <CardTitle>Personal Information</CardTitle>
                </CardHeader>
                <CardContent>
                    <form className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="name" className="block text-sm font-medium mb-2">
                                    Full Name
                                </label>
                                <Input
                                    id="name"
                                    {...registerProfile('name')}
                                    onChange={(e) => {
                                        registerProfile('name').onChange(e)
                                        setUnsavedChanges(true)
                                    }}
                                />
                                {profileErrors.name && (
                                    <p className="text-sm text-red-600 mt-1">
                                        {profileErrors.name.message}
                                    </p>
                                )}
                            </div>

                            <div>
                                <label htmlFor="title" className="block text-sm font-medium mb-2">
                                    Professional Title
                                </label>
                                <Input
                                    id="title"
                                    placeholder="e.g., Full Stack Developer"
                                    {...registerProfile('title')}
                                    onChange={(e) => {
                                        registerProfile('title').onChange(e)
                                        setUnsavedChanges(true)
                                    }}
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="bio" className="block text-sm font-medium mb-2">
                                Bio
                            </label>
                            <textarea
                                id="bio"
                                rows={4}
                                maxLength={500}
                                placeholder="Tell us about yourself..."
                                {...registerProfile('bio')}
                                onChange={(e) => {
                                    registerProfile('bio').onChange(e)
                                    setUnsavedChanges(true)
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent resize-none"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                {bioValue.length}/500 characters
                            </p>
                        </div>
                    </form>
                </CardContent>
            </Card>

            {/* Contact Information */}
            <Card>
                <CardHeader>
                    <CardTitle>Contact Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium mb-2">
                            Email Address
                        </label>
                        <div className="flex items-center space-x-2">
                            <div className="relative flex-1">
                                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <Input
                                    id="email"
                                    type="email"
                                    className="pl-10"
                                    {...registerProfile('email')}
                                    onChange={(e) => {
                                        registerProfile('email').onChange(e)
                                        setUnsavedChanges(true)
                                    }}
                                />
                            </div>
                            {user?.emailVerified ? (
                                <Badge variant="success">Verified</Badge>
                            ) : (
                                <Button variant="outline" size="sm">
                                    Verify
                                </Button>
                            )}
                        </div>
                        {profileErrors.email && (
                            <p className="text-sm text-red-600 mt-1">
                                {profileErrors.email.message}
                            </p>
                        )}
                    </div>

                    <div>
                        <label htmlFor="phone" className="block text-sm font-medium mb-2">
                            Phone Number
                        </label>
                        <div className="relative">
                            <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <Input
                                id="phone"
                                type="tel"
                                placeholder="+1 (555) 000-0000"
                                className="pl-10"
                                {...registerProfile('phone')}
                                onChange={(e) => {
                                    registerProfile('phone').onChange(e)
                                    setUnsavedChanges(true)
                                }}
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Localization */}
            <Card>
                <CardHeader>
                    <CardTitle>Localization</CardTitle>
                </CardHeader>
                <CardContent>
                    <form className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="timezone" className="block text-sm font-medium mb-2">
                                    <Globe className="w-4 h-4 inline mr-2" />
                                    Timezone
                                </label>
                                <select
                                    id="timezone"
                                    {...registerLocalization('timezone')}
                                    onChange={(e) => {
                                        registerLocalization('timezone').onChange(e)
                                        setUnsavedChanges(true)
                                    }}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent"
                                >
                                    <option value="America/New_York">Eastern Time (ET)</option>
                                    <option value="America/Chicago">Central Time (CT)</option>
                                    <option value="America/Denver">Mountain Time (MT)</option>
                                    <option value="America/Los_Angeles">Pacific Time (PT)</option>
                                    <option value="Asia/Kolkata">India Standard Time (IST)</option>
                                    <option value="Europe/London">Greenwich Mean Time (GMT)</option>
                                </select>
                            </div>

                            <div>
                                <label htmlFor="language" className="block text-sm font-medium mb-2">
                                    Language
                                </label>
                                <select
                                    id="language"
                                    {...registerLocalization('language')}
                                    onChange={(e) => {
                                        registerLocalization('language').onChange(e)
                                        setUnsavedChanges(true)
                                    }}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent"
                                >
                                    <option value="en">English</option>
                                    <option value="kn">Kannada</option>
                                    <option value="hi">Hindi</option>
                                    <option value="es">Spanish</option>
                                    <option value="fr">French</option>
                                </select>
                            </div>

                            <div>
                                <label htmlFor="currency" className="block text-sm font-medium mb-2">
                                    Currency
                                </label>
                                <select
                                    id="currency"
                                    {...registerLocalization('currency')}
                                    onChange={(e) => {
                                        registerLocalization('currency').onChange(e)
                                        setUnsavedChanges(true)
                                    }}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent"
                                >
                                    <option value="USD">USD ($)</option>
                                    <option value="INR">INR (₹)</option>
                                    <option value="EUR">EUR (€)</option>
                                    <option value="GBP">GBP (£)</option>
                                </select>
                            </div>

                            <div>
                                <label htmlFor="dateFormat" className="block text-sm font-medium mb-2">
                                    <Calendar className="w-4 h-4 inline mr-2" />
                                    Date Format
                                </label>
                                <select
                                    id="dateFormat"
                                    {...registerLocalization('dateFormat')}
                                    onChange={(e) => {
                                        registerLocalization('dateFormat').onChange(e)
                                        setUnsavedChanges(true)
                                    }}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent"
                                >
                                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                                </select>
                            </div>
                        </div>
                    </form>
                </CardContent>
            </Card>

            {/* Floating Save Bar */}
            <FloatingSaveBar
                onSave={handleSaveChanges}
                onDiscard={handleDiscardChanges}
            />
        </div>
    )
}
