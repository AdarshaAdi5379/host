import { Globe, Layers, FolderOpen, Database, Cpu } from 'lucide-react'
import { Link } from 'react-router-dom'

const quickActions = [
    {
        name: 'New WordPress Site',
        description: 'Deploy a WordPress site',
        icon: Globe,
        href: '/hosting/create',
        color: 'bg-blue-100 text-blue-600',
        hoverBg: 'hover:border-blue-300 hover:bg-blue-50',
    },
    {
        name: 'EC2 Service',
        description: 'Manage VM instances',
        icon: Cpu,
        href: '/ec2',
        color: 'bg-indigo-100 text-indigo-600',
        hoverBg: 'hover:border-indigo-300 hover:bg-indigo-50',
    },
    {
        name: 'New Full Stack App',
        description: 'React + Django from GitHub',
        icon: Layers,
        href: '/hosting/create-fullstack',
        color: 'bg-purple-100 text-purple-600',
        hoverBg: 'hover:border-purple-300 hover:bg-purple-50',
    },
    {
        name: 'File Manager',
        description: 'Browse project files',
        icon: FolderOpen,
        href: '/hosting/files',
        color: 'bg-emerald-100 text-emerald-600',
        hoverBg: 'hover:border-emerald-300 hover:bg-emerald-50',
    },
    {
        name: 'Databases',
        description: 'Manage MySQL databases',
        icon: Database,
        href: '/hosting/databases',
        color: 'bg-orange-100 text-orange-600',
        hoverBg: 'hover:border-orange-300 hover:bg-orange-50',
    },
]

export function QuickActions() {
    return (
        <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Quick Actions</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {quickActions.map((action) => {
                    const Icon = action.icon
                    return (
                        <Link
                            key={action.name}
                            to={action.href}
                            className={`flex items-center gap-3 p-4 rounded-xl border border-gray-200 bg-white transition-all duration-200 ${action.hoverBg} hover:shadow-sm group`}
                        >
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${action.color} group-hover:scale-110 transition-transform`}>
                                <Icon className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-gray-900 leading-tight">{action.name}</p>
                                <p className="text-xs text-gray-500 mt-0.5 truncate">{action.description}</p>
                            </div>
                        </Link>
                    )
                })}
            </div>
        </div>
    )
}
