import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FolderOpen, Database, ExternalLink } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export function QuickAccessPanel() {
    const navigate = useNavigate()

    const tools = [
        {
            icon: FolderOpen,
            label: 'File Manager',
            description: 'Browse and manage your website files',
            action: () => navigate('/hosting/files'),
            color: 'bg-blue-100 text-blue-600',
        },
        {
            icon: Database,
            label: 'MySQL Databases',
            description: 'Create and manage databases',
            action: () => navigate('/hosting/databases'),
            color: 'bg-purple-100 text-purple-600',
        },
        {
            icon: ExternalLink,
            label: 'phpMyAdmin',
            description: 'Access database management tool',
            action: () => window.open('https://phpmyadmin.example.com', '_blank'),
            color: 'bg-green-100 text-green-600',
            external: true,
        },
    ]

    return (
        <Card>
            <CardHeader>
                <CardTitle>Quick Access</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {tools.map((tool) => {
                    const Icon = tool.icon
                    return (
                        <button
                            key={tool.label}
                            onClick={tool.action}
                            className="p-4 text-left border border-gray-200 rounded-lg hover:border-brand-purple hover:shadow-md transition-all group"
                        >
                            <div className={`w-12 h-12 ${tool.color} rounded-lg flex items-center justify-center mb-3`}>
                                <Icon className="w-6 h-6" />
                            </div>
                            <h3 className="font-semibold mb-1 group-hover:text-brand-purple transition-colors">
                                {tool.label}
                                {tool.external && (
                                    <ExternalLink className="w-3 h-3 inline ml-1" />
                                )}
                            </h3>
                            <p className="text-sm text-gray-600">{tool.description}</p>
                        </button>
                    )
                })}
            </CardContent>
        </Card>
    )
}
