import { Outlet, NavLink } from 'react-router-dom'
import { User, Shield, Bell, Monitor } from 'lucide-react'

const settingsTabs = [
    {
        id: 'general',
        label: 'General',
        icon: User,
        path: '/settings/general',
    },
    {
        id: 'security',
        label: 'Security',
        icon: Shield,
        path: '/settings/security',
    },
    {
        id: 'notifications',
        label: 'Notifications',
        icon: Bell,
        path: '/settings/notifications',
    },
    {
        id: 'sessions',
        label: 'Active Sessions',
        icon: Monitor,
        path: '/settings/sessions',
    },
]

export function SettingsLayout() {
    return (
        <div className="max-w-7xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-brand-navy">Settings</h1>
                <p className="text-gray-600 mt-2">
                    Manage your account settings and preferences
                </p>
            </div>

            <div className="flex flex-col lg:flex-row gap-6">
                {/* Vertical Navigation - Desktop */}
                <nav className="hidden lg:block w-64 flex-shrink-0">
                    <div className="bg-white rounded-xl border border-gray-200 p-2">
                        {settingsTabs.map((tab) => {
                            const Icon = tab.icon
                            return (
                                <NavLink
                                    key={tab.id}
                                    to={tab.path}
                                    className={({ isActive }) =>
                                        `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${isActive
                                            ? 'bg-brand-purple text-white'
                                            : 'text-gray-700 hover:bg-gray-100'
                                        }`
                                    }
                                >
                                    <Icon className="w-5 h-5" />
                                    <span className="font-medium">{tab.label}</span>
                                </NavLink>
                            )
                        })}
                    </div>
                </nav>

                {/* Top Navigation - Mobile */}
                <nav className="lg:hidden overflow-x-auto">
                    <div className="flex space-x-2 bg-white rounded-xl border border-gray-200 p-2">
                        {settingsTabs.map((tab) => {
                            const Icon = tab.icon
                            return (
                                <NavLink
                                    key={tab.id}
                                    to={tab.path}
                                    className={({ isActive }) =>
                                        `flex items-center space-x-2 px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${isActive
                                            ? 'bg-brand-purple text-white'
                                            : 'text-gray-700 hover:bg-gray-100'
                                        }`
                                    }
                                >
                                    <Icon className="w-4 h-4" />
                                    <span className="text-sm font-medium">{tab.label}</span>
                                </NavLink>
                            )
                        })}
                    </div>
                </nav>

                {/* Content Area */}
                <div className="flex-1 min-w-0">
                    <Outlet />
                </div>
            </div>
        </div>
    )
}
