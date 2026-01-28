import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FloatingSaveBar } from '@/components/settings/FloatingSaveBar'
import { useSettingsStore } from '@/store/settingsStore'
import { useToast } from '@/components/ui/toast'
import { Bell, Mail, MessageSquare, Smartphone } from 'lucide-react'

export function NotificationSettings() {
    const { notifications, updateNotifications, setUnsavedChanges } = useSettingsStore()
    const { addToast } = useToast()

    const handleToggle = (
        category: keyof typeof notifications,
        field: keyof typeof notifications.securityAlerts
    ) => {
        updateNotifications({
            [category]: {
                ...notifications[category],
                [field]: !notifications[category][field],
            },
        })
    }

    const handleSave = async () => {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        addToast({
            title: 'Preferences Saved',
            description: 'Your notification preferences have been updated',
            variant: 'success',
        })
        setUnsavedChanges(false)
    }

    const handleDiscard = () => {
        setUnsavedChanges(false)
        addToast({
            title: 'Changes Discarded',
            description: 'Your changes have been discarded',
            variant: 'default',
        })
    }

    return (
        <div className="space-y-6">
            {/* Security Alerts */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center space-x-2">
                            <Bell className="w-5 h-5" />
                            <span>Security Alerts</span>
                        </CardTitle>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={notifications.securityAlerts.enabled}
                                onChange={() => handleToggle('securityAlerts', 'enabled')}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-purple"></div>
                        </label>
                    </div>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-gray-600 mb-4">
                        Get notified about login attempts from new devices and suspicious activity
                    </p>
                    <div className="space-y-3">
                        <label className="flex items-center space-x-3">
                            <input
                                type="checkbox"
                                checked={notifications.securityAlerts.email}
                                onChange={() => handleToggle('securityAlerts', 'email')}
                                disabled={!notifications.securityAlerts.enabled}
                                className="rounded border-gray-300 text-brand-purple focus:ring-brand-purple disabled:opacity-50"
                            />
                            <Mail className="w-4 h-4 text-gray-500" />
                            <span className="text-sm">Email</span>
                        </label>
                        <label className="flex items-center space-x-3">
                            <input
                                type="checkbox"
                                checked={notifications.securityAlerts.sms}
                                onChange={() => handleToggle('securityAlerts', 'sms')}
                                disabled={!notifications.securityAlerts.enabled}
                                className="rounded border-gray-300 text-brand-purple focus:ring-brand-purple disabled:opacity-50"
                            />
                            <MessageSquare className="w-4 h-4 text-gray-500" />
                            <span className="text-sm">SMS</span>
                        </label>
                        <label className="flex items-center space-x-3">
                            <input
                                type="checkbox"
                                checked={notifications.securityAlerts.push}
                                onChange={() => handleToggle('securityAlerts', 'push')}
                                disabled={!notifications.securityAlerts.enabled}
                                className="rounded border-gray-300 text-brand-purple focus:ring-brand-purple disabled:opacity-50"
                            />
                            <Smartphone className="w-4 h-4 text-gray-500" />
                            <span className="text-sm">Push Notifications</span>
                        </label>
                    </div>
                </CardContent>
            </Card>

            {/* Billing Notifications */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>Billing Notifications</CardTitle>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={notifications.billing.enabled}
                                onChange={() => handleToggle('billing', 'enabled')}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-purple"></div>
                        </label>
                    </div>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-gray-600 mb-4">
                        Receive updates about invoices, payments, and subscription renewals
                    </p>
                    <div className="space-y-3">
                        <label className="flex items-center space-x-3">
                            <input
                                type="checkbox"
                                checked={notifications.billing.email}
                                onChange={() => handleToggle('billing', 'email')}
                                disabled={!notifications.billing.enabled}
                                className="rounded border-gray-300 text-brand-purple focus:ring-brand-purple disabled:opacity-50"
                            />
                            <Mail className="w-4 h-4 text-gray-500" />
                            <span className="text-sm">Email</span>
                        </label>
                        <label className="flex items-center space-x-3">
                            <input
                                type="checkbox"
                                checked={notifications.billing.sms}
                                onChange={() => handleToggle('billing', 'sms')}
                                disabled={!notifications.billing.enabled}
                                className="rounded border-gray-300 text-brand-purple focus:ring-brand-purple disabled:opacity-50"
                            />
                            <MessageSquare className="w-4 h-4 text-gray-500" />
                            <span className="text-sm">SMS</span>
                        </label>
                        <label className="flex items-center space-x-3">
                            <input
                                type="checkbox"
                                checked={notifications.billing.push}
                                onChange={() => handleToggle('billing', 'push')}
                                disabled={!notifications.billing.enabled}
                                className="rounded border-gray-300 text-brand-purple focus:ring-brand-purple disabled:opacity-50"
                            />
                            <Smartphone className="w-4 h-4 text-gray-500" />
                            <span className="text-sm">Push Notifications</span>
                        </label>
                    </div>
                </CardContent>
            </Card>

            {/* System Updates */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>System Updates</CardTitle>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={notifications.systemUpdates.enabled}
                                onChange={() => handleToggle('systemUpdates', 'enabled')}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-purple"></div>
                        </label>
                    </div>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-gray-600 mb-4">
                        Stay informed about maintenance windows and platform updates
                    </p>
                    <div className="space-y-3">
                        <label className="flex items-center space-x-3">
                            <input
                                type="checkbox"
                                checked={notifications.systemUpdates.email}
                                onChange={() => handleToggle('systemUpdates', 'email')}
                                disabled={!notifications.systemUpdates.enabled}
                                className="rounded border-gray-300 text-brand-purple focus:ring-brand-purple disabled:opacity-50"
                            />
                            <Mail className="w-4 h-4 text-gray-500" />
                            <span className="text-sm">Email</span>
                        </label>
                        <label className="flex items-center space-x-3">
                            <input
                                type="checkbox"
                                checked={notifications.systemUpdates.sms}
                                onChange={() => handleToggle('systemUpdates', 'sms')}
                                disabled={!notifications.systemUpdates.enabled}
                                className="rounded border-gray-300 text-brand-purple focus:ring-brand-purple disabled:opacity-50"
                            />
                            <MessageSquare className="w-4 h-4 text-gray-500" />
                            <span className="text-sm">SMS</span>
                        </label>
                        <label className="flex items-center space-x-3">
                            <input
                                type="checkbox"
                                checked={notifications.systemUpdates.push}
                                onChange={() => handleToggle('systemUpdates', 'push')}
                                disabled={!notifications.systemUpdates.enabled}
                                className="rounded border-gray-300 text-brand-purple focus:ring-brand-purple disabled:opacity-50"
                            />
                            <Smartphone className="w-4 h-4 text-gray-500" />
                            <span className="text-sm">Push Notifications</span>
                        </label>
                    </div>
                </CardContent>
            </Card>

            {/* Marketing Communications */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>Marketing Communications</CardTitle>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={notifications.marketing.enabled}
                                onChange={() => handleToggle('marketing', 'enabled')}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-purple"></div>
                        </label>
                    </div>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-gray-600 mb-4">
                        Receive newsletters, product updates, and promotional offers
                    </p>
                    <div className="space-y-3">
                        <label className="flex items-center space-x-3">
                            <input
                                type="checkbox"
                                checked={notifications.marketing.email}
                                onChange={() => handleToggle('marketing', 'email')}
                                disabled={!notifications.marketing.enabled}
                                className="rounded border-gray-300 text-brand-purple focus:ring-brand-purple disabled:opacity-50"
                            />
                            <Mail className="w-4 h-4 text-gray-500" />
                            <span className="text-sm">Email</span>
                        </label>
                        <label className="flex items-center space-x-3">
                            <input
                                type="checkbox"
                                checked={notifications.marketing.sms}
                                onChange={() => handleToggle('marketing', 'sms')}
                                disabled={!notifications.marketing.enabled}
                                className="rounded border-gray-300 text-brand-purple focus:ring-brand-purple disabled:opacity-50"
                            />
                            <MessageSquare className="w-4 h-4 text-gray-500" />
                            <span className="text-sm">SMS</span>
                        </label>
                        <label className="flex items-center space-x-3">
                            <input
                                type="checkbox"
                                checked={notifications.marketing.push}
                                onChange={() => handleToggle('marketing', 'push')}
                                disabled={!notifications.marketing.enabled}
                                className="rounded border-gray-300 text-brand-purple focus:ring-brand-purple disabled:opacity-50"
                            />
                            <Smartphone className="w-4 h-4 text-gray-500" />
                            <span className="text-sm">Push Notifications</span>
                        </label>
                    </div>
                </CardContent>
            </Card>

            <FloatingSaveBar onSave={handleSave} onDiscard={handleDiscard} />
        </div>
    )
}
