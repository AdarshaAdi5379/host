import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Mail, ExternalLink, Trash2, Edit } from 'lucide-react'
import { useToast } from '@/components/ui/toast'

interface EmailAccount {
    id: string
    address: string
    quota: number // MB
    used: number // MB
    created: string
}

export function EmailAccountList() {
    const [accounts, setAccounts] = useState<EmailAccount[]>([])
    const { addToast } = useToast()

    const handleDelete = (id: string) => {
        const account = accounts.find((a) => a.id === id)
        setAccounts(accounts.filter((a) => a.id !== id))
        addToast({
            title: 'Account Deleted',
            description: `${account?.address} has been removed`,
            variant: 'success',
        })
    }

    const getPercentage = (used: number, quota: number) => {
        return Math.round((used / quota) * 100)
    }

    const getVariant = (percentage: number) => {
        if (percentage >= 90) return 'danger'
        if (percentage >= 75) return 'warning'
        return 'primary'
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                    <Mail className="w-5 h-5 text-brand-purple" />
                    <span>Email Accounts</span>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Email Address</TableHead>
                            <TableHead>Storage Usage</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {accounts.map((account) => {
                            const percentage = getPercentage(account.used, account.quota)
                            const variant = getVariant(percentage)

                            return (
                                <TableRow key={account.id} className="group">
                                    <TableCell>
                                        <span className="font-mono font-semibold">
                                            {account.address}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between text-sm">
                                                <span>
                                                    {account.used} MB / {account.quota} MB
                                                </span>
                                                <Badge variant={variant === 'danger' ? 'error' : variant === 'warning' ? 'warning' : 'default'}>
                                                    {percentage}%
                                                </Badge>
                                            </div>
                                            <Progress value={percentage} variant={variant} />
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-sm text-gray-600">
                                            {account.created}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button variant="ghost" size="sm" title="Open Webmail">
                                                <ExternalLink className="w-4 h-4" />
                                            </Button>
                                            <Button variant="ghost" size="sm" title="Edit">
                                                <Edit className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleDelete(account.id)}
                                                title="Delete"
                                            >
                                                <Trash2 className="w-4 h-4 text-red-600" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    )
}
