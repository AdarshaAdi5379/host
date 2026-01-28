import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Shield, Lock, Wrench } from 'lucide-react'
import { useToast } from '@/components/ui/toast'

interface ToggleSetting {
    id: string
    label: string
    description: string
    enabled: boolean
    icon: React.ElementType
}

export function CMSToolkit() {
    const { addToast } = useToast()
    const [settings, setSettings] = useState<ToggleSetting[]>([
        {
            id: 'ssl',
            label: 'SSL Certificate',
            description: 'Force HTTPS for all connections',
            enabled: true,
            icon: Lock,
        },
        {
            id: 'cache',
            label: 'Cache System',
            description: 'Enable server-side caching',
            enabled: true,
            icon: Shield,
        },
        {
            id: 'maintenance',
            label: 'Maintenance Mode',
            description: 'Display maintenance page to visitors',
            enabled: false,
            icon: Wrench,
        },
    ])

    const handleToggle = (id: string) => {
        setSettings((prev) =>
            prev.map((setting) =>
                setting.id === id ? { ...setting, enabled: !setting.enabled } : setting
            )
        )

        const setting = settings.find((s) => s.id === id)
        addToast({
            title: 'Setting Updated',
            description: `${setting?.label} has been ${setting?.enabled ? 'disabled' : 'enabled'}`,
            variant: 'success',
        })
    }

    const handleClearCache = () => {
        addToast({
            title: 'Cache Cleared',
            description: 'All cached files have been removed successfully',
            variant: 'success',
        })
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>WordPress/CMS Toolkit</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {settings.map((setting) => {
                    const Icon = setting.icon
                    return (
                        <div
                            key={setting.id}
                            className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                        >
                            <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                                    <Icon className="w-5 h-5 text-gray-600" />
                                </div>
                                <div>
                                    <div className="flex items-center space-x-2">
                                        <h4 className="font-medium">{setting.label}</h4>
                                        <Badge variant={setting.enabled ? 'success' : 'default'}>
                                            {setting.enabled ? 'Active' : 'Inactive'}
                                        </Badge>
                                    </div>
                                    <p className="text-sm text-gray-600">{setting.description}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => handleToggle(setting.id)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${setting.enabled ? 'bg-brand-purple' : 'bg-gray-300'
                                    }`}
                            >
                                <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${setting.enabled ? 'translate-x-6' : 'translate-x-1'
                                        }`}
                                />
                            </button>
                        </div>
                    )
                })}

                <button
                    onClick={handleClearCache}
                    className="w-full p-3 text-sm font-medium text-brand-purple border border-brand-purple rounded-lg hover:bg-brand-purple hover:text-white transition-colors"
                >
                    Clear All Cache
                </button>
            </CardContent>
        </Card>
    )
}
