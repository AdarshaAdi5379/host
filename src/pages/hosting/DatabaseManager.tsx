import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Plus, ExternalLink, Trash2 } from 'lucide-react'
import type { Database } from '@/data/mockData'
import { formatBytes } from '@/lib/utils'

export function DatabaseManager() {
    const [databases, setDatabases] = useState<Database[]>([])

    const handleDelete = (id: string) => {
        setDatabases(databases.filter(db => db.id !== id))
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-brand-navy">Database Manager</h1>
                    <p className="text-gray-600 mt-1">Manage MySQL databases and users</p>
                </div>
                <Button variant="primary">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Database
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>MySQL Databases</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Database Name</TableHead>
                                <TableHead>Size</TableHead>
                                <TableHead>Tables</TableHead>
                                <TableHead>Users</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {databases.map((db) => (
                                <TableRow key={db.id} className="group">
                                    <TableCell>
                                        <span className="font-mono font-semibold">{db.name}</span>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="default">{formatBytes(db.size)}</Badge>
                                    </TableCell>
                                    <TableCell>
                                        <span>{db.tables} tables</span>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-wrap gap-1">
                                            {db.users.map((user, idx) => (
                                                <Badge key={idx} variant="info" className="text-xs">
                                                    {user}
                                                </Badge>
                                            ))}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                title="Open phpMyAdmin"
                                            >
                                                <ExternalLink className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => handleDelete(db.id)}
                                            >
                                                <Trash2 className="w-4 h-4 text-red-600" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="pt-6">
                        <h3 className="font-semibold mb-2">Create User</h3>
                        <p className="text-sm text-gray-600">Add a new MySQL user with specific privileges</p>
                    </CardContent>
                </Card>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="pt-6">
                        <h3 className="font-semibold mb-2">Import Database</h3>
                        <p className="text-sm text-gray-600">Upload and restore from SQL backup file</p>
                    </CardContent>
                </Card>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="pt-6">
                        <h3 className="font-semibold mb-2">Backup All</h3>
                        <p className="text-sm text-gray-600">Create backups of all databases</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
