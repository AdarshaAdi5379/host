import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
    Home,
    Server,
    Globe,
    Mail,
    CreditCard,
    ChevronLeft,
    ChevronRight,
    GitBranch,
} from 'lucide-react'
import { useState } from 'react'

const navigation = [
    { name: 'Home', href: '/', icon: Home },
    { name: 'Hosting', href: '/hosting', icon: Server },
    { name: 'Domains', href: '/domains', icon: Globe },
    { name: 'Emails', href: '/email', icon: Mail },
    { name: 'Deployment', href: '/deployment/git', icon: GitBranch },
    { name: 'Billing', href: '/billing', icon: CreditCard },
]

export function Sidebar() {
    const location = useLocation()
    const [collapsed, setCollapsed] = useState(false)

    return (
        <div
            className={cn(
                'flex flex-col bg-brand-navy text-white transition-all duration-200',
                collapsed ? 'w-16' : 'w-64'
            )}
        >
            {/* Logo */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
                {!collapsed && (
                    <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 bg-brand-purple rounded-lg flex items-center justify-center">
                            <Server className="w-5 h-5" />
                        </div>
                        <span className="font-bold text-lg">HostPanel</span>
                    </div>
                )}
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="p-1 hover:bg-white/10 rounded transition-colors"
                >
                    {collapsed ? (
                        <ChevronRight className="w-5 h-5" />
                    ) : (
                        <ChevronLeft className="w-5 h-5" />
                    )}
                </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 space-y-1">
                {navigation.map((item) => {
                    const isActive = location.pathname === item.href
                    const Icon = item.icon

                    return (
                        <Link
                            key={item.name}
                            to={item.href}
                            className={cn(
                                'flex items-center space-x-3 px-3 py-2 rounded-lg transition-all duration-200',
                                isActive
                                    ? 'bg-brand-purple text-white'
                                    : 'text-gray-300 hover:bg-white/10 hover:text-white'
                            )}
                        >
                            <Icon className="w-5 h-5 flex-shrink-0" />
                            {!collapsed && <span className="font-medium">{item.name}</span>}
                        </Link>
                    )
                })}
            </nav>

            {/* User Section */}
            <div className="p-4 border-t border-white/10">
                <div
                    className={cn(
                        'flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors cursor-pointer',
                        collapsed && 'justify-center'
                    )}
                >
                    <div className="w-8 h-8 bg-brand-purple rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-semibold">JD</span>
                    </div>
                    {!collapsed && (
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">John Doe</p>
                            <p className="text-xs text-gray-400 truncate">john@example.com</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
