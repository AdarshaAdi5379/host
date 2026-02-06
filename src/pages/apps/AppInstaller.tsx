import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Search, Download, Star } from 'lucide-react'
import type { App } from '@/data/mockData'

export function AppInstaller() {
    const [apps] = useState<App[]>([])
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedCategory, setSelectedCategory] = useState<string>('all')

    const categories = ['all', 'CMS', 'Framework', 'E-commerce', 'Blog']

    const filteredApps = apps.filter(app => {
        const matchesSearch = app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            app.description.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesCategory = selectedCategory === 'all' || app.category === selectedCategory
        return matchesSearch && matchesCategory
    })

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-brand-navy">App Installer</h1>
                <p className="text-gray-600 mt-1">Install popular applications with one click</p>
            </div>

            {/* Search and Filter */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input
                        placeholder="Search applications..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>
                <div className="flex space-x-2">
                    {categories.map((category) => (
                        <Button
                            key={category}
                            variant={selectedCategory === category ? 'primary' : 'secondary'}
                            onClick={() => setSelectedCategory(category)}
                        >
                            {category.charAt(0).toUpperCase() + category.slice(1)}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Apps Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredApps.map((app) => (
                    <Card key={app.id} className="hover:shadow-lg transition-shadow">
                        <CardHeader>
                            <div className="flex items-start justify-between">
                                <div className="flex items-center space-x-3">
                                    <div className="text-4xl">{app.icon}</div>
                                    <div>
                                        <CardTitle className="text-lg">{app.name}</CardTitle>
                                        <Badge variant="info" className="mt-1">
                                            {app.category}
                                        </Badge>
                                    </div>
                                </div>
                                <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-sm text-gray-600">{app.description}</p>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-500">Version {app.version}</span>
                                <Button variant="primary" size="sm">
                                    <Download className="w-4 h-4 mr-2" />
                                    Install
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {filteredApps.length === 0 && (
                <Card>
                    <CardContent className="py-12 text-center">
                        <p className="text-gray-500">No applications found matching your criteria.</p>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
