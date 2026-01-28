import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FolderOpen, Database, Wrench, Shield, Terminal, Settings } from 'lucide-react'
import { Link } from 'react-router-dom'

const quickActions = [
    {
        name: 'File Manager',
        icon: FolderOpen,
        href: '/hosting/files',
        color: 'bg-blue-100 text-blue-600',
    },
    {
        name: 'Databases',
        icon: Database,
        href: '/hosting/databases',
        color: 'bg-green-100 text-green-600',
    },
    {
        name: 'WordPress',
        icon: Wrench,
        href: '/hosting/wordpress',
        color: 'bg-purple-100 text-purple-600',
    },
    {
        name: 'SSL/TLS',
        icon: Shield,
        href: '/hosting/ssl',
        color: 'bg-yellow-100 text-yellow-600',
    },
    {
        name: 'Terminal',
        icon: Terminal,
        href: '/hosting/terminal',
        color: 'bg-gray-100 text-gray-600',
    },
    {
        name: 'DNS',
        icon: Settings,
        href: '/hosting/dns',
        color: 'bg-red-100 text-red-600',
    },
]

export function QuickActions() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {quickActions.map((action) => {
                        const Icon = action.icon
                        return (
                            <Link
                                key={action.name}
                                to={action.href}
                                className="flex flex-col items-center p-4 rounded-lg hover:bg-gray-50 transition-colors group"
                            >
                                <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-2 ${action.color} group-hover:scale-110 transition-transform`}>
                                    <Icon className="w-6 h-6" />
                                </div>
                                <span className="text-sm font-medium text-center">{action.name}</span>
                            </Link>
                        )
                    })}
                </div>
            </CardContent>
        </Card>
    )
}
