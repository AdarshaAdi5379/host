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
import { Pencil, Trash2, Plus } from 'lucide-react'
import type { DNSRecord } from '@/data/mockData'
import { mockDNSRecords } from '@/data/mockData'

export function DNSEditor() {
    const [records, setRecords] = useState<DNSRecord[]>(mockDNSRecords)
    const [editingId, setEditingId] = useState<string | null>(null)

    const getRecordTypeBadgeColor = (type: DNSRecord['type']) => {
        const colors = {
            A: 'bg-blue-100 text-blue-800',
            AAAA: 'bg-purple-100 text-purple-800',
            CNAME: 'bg-green-100 text-green-800',
            MX: 'bg-yellow-100 text-yellow-800',
            TXT: 'bg-gray-100 text-gray-800',
            NS: 'bg-red-100 text-red-800',
        }
        return colors[type] || 'bg-gray-100 text-gray-800'
    }

    const handleDelete = (id: string) => {
        setRecords(records.filter(r => r.id !== id))
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-brand-navy">DNS Zone Editor</h1>
                    <p className="text-gray-600 mt-1">Manage DNS records for your domain</p>
                </div>
                <Button variant="primary">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Record
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>DNS Records</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Type</TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead>Value</TableHead>
                                <TableHead>TTL</TableHead>
                                <TableHead>Priority</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {records.map((record) => (
                                <TableRow key={record.id} className="group">
                                    <TableCell>
                                        <Badge className={getRecordTypeBadgeColor(record.type)}>
                                            {record.type}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {editingId === record.id ? (
                                            <Input
                                                defaultValue={record.name}
                                                className="h-8"
                                            />
                                        ) : (
                                            <span className="font-mono text-sm">{record.name}</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {editingId === record.id ? (
                                            <Input
                                                defaultValue={record.value}
                                                className="h-8"
                                            />
                                        ) : (
                                            <span className="font-mono text-sm">{record.value}</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {editingId === record.id ? (
                                            <Input
                                                type="number"
                                                defaultValue={record.ttl}
                                                className="h-8 w-24"
                                            />
                                        ) : (
                                            <span>{record.ttl}</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {record.priority !== undefined ? (
                                            editingId === record.id ? (
                                                <Input
                                                    type="number"
                                                    defaultValue={record.priority}
                                                    className="h-8 w-20"
                                                />
                                            ) : (
                                                <span>{record.priority}</span>
                                            )
                                        ) : (
                                            <span className="text-gray-400">-</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {editingId === record.id ? (
                                                <>
                                                    <Button
                                                        size="sm"
                                                        variant="primary"
                                                        onClick={() => setEditingId(null)}
                                                    >
                                                        Save
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => setEditingId(null)}
                                                    >
                                                        Cancel
                                                    </Button>
                                                </>
                                            ) : (
                                                <>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => setEditingId(record.id)}
                                                    >
                                                        <Pencil className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => handleDelete(record.id)}
                                                    >
                                                        <Trash2 className="w-4 h-4 text-red-600" />
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
