import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Search, Calendar } from 'lucide-react'
import { useToast } from '@/components/ui/toast'

interface Domain {
    id: string
    name: string
    expiresIn: number // days
    autoRenew: boolean
    status: 'active' | 'expiring' | 'expired'
}

const mockDomains: Domain[] = [
    { id: '1', name: 'example.com', expiresIn: 45, autoRenew: true, status: 'active' },
    { id: '2', name: 'mysite.net', expiresIn: 15, autoRenew: false, status: 'expiring' },
    { id: '3', name: 'portfolio.io', expiresIn: 120, autoRenew: true, status: 'active' },
    { id: '4', name: 'shop.store', expiresIn: 5, autoRenew: false, status: 'expiring' },
]

export function DomainPortfolio() {
    const [domains, setDomains] = useState<Domain[]>(mockDomains)
    const [searchQuery, setSearchQuery] = useState('')
    const { addToast } = useToast()

    const filteredDomains = domains.filter((domain) =>
        domain.name.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const handleToggleAutoRenew = (id: string) => {
        setDomains((prev) =>
            prev.map((domain) =>
                domain.id === id ? { ...domain, autoRenew: !domain.autoRenew } : domain
            )
        )

        const domain = domains.find((d) => d.id === id)
        addToast({
            title: 'Auto-Renew Updated',
            description: `Auto-renew for ${domain?.name} has been ${domain?.autoRenew ? 'disabled' : 'enabled'}`,
            variant: 'success',
        })
    }

    const getExpirationColor = (days: number) => {
        if (days <= 7) return 'text-red-600 font-semibold'
        if (days <= 30) return 'text-yellow-600 font-medium'
        return 'text-gray-600'
    }

    const getStatusBadge = (status: Domain['status']) => {
        const variants = {
            active: 'success',
            expiring: 'warning',
            expired: 'error',
        } as const
        return variants[status]
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle>Domain Portfolio</CardTitle>
                    <div className="relative w-64">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                            placeholder="Search domains..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Domain Name</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Expires In</TableHead>
                            <TableHead>Auto-Renew</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredDomains.map((domain) => (
                            <TableRow key={domain.id}>
                                <TableCell>
                                    <span className="font-mono font-semibold">{domain.name}</span>
                                </TableCell>
                                <TableCell>
                                    <Badge variant={getStatusBadge(domain.status)}>
                                        {domain.status}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center space-x-2">
                                        <Calendar className="w-4 h-4 text-gray-400" />
                                        <span className={getExpirationColor(domain.expiresIn)}>
                                            {domain.expiresIn} days
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <button
                                        onClick={() => handleToggleAutoRenew(domain.id)}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${domain.autoRenew ? 'bg-brand-purple' : 'bg-gray-300'
                                            }`}
                                    >
                                        <span
                                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${domain.autoRenew ? 'translate-x-6' : 'translate-x-1'
                                                }`}
                                        />
                                    </button>
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="sm">
                                        Manage
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>

                {filteredDomains.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                        No domains found matching "{searchQuery}"
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
