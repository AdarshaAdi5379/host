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
import { FolderOpen, File, Download, Trash2, Upload, Plus } from 'lucide-react'
import type { FileItem } from '@/data/mockData'
import { mockFiles } from '@/data/mockData'
import { formatBytes, formatDateTime } from '@/lib/utils'

export function FileManager() {
    const [files, setFiles] = useState<FileItem[]>(mockFiles)
    const [currentPath, setCurrentPath] = useState('/public_html')

    const currentFiles = files.filter(f =>
        f.path.startsWith(currentPath) &&
        f.path.split('/').length === currentPath.split('/').length + 1
    )

    const handleDelete = (id: string) => {
        setFiles(files.filter(f => f.id !== id))
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-brand-navy">File Manager</h1>
                    <p className="text-gray-600 mt-1">Browse and manage your website files</p>
                </div>
                <div className="flex space-x-2">
                    <Button variant="secondary">
                        <Upload className="w-4 h-4 mr-2" />
                        Upload
                    </Button>
                    <Button variant="primary">
                        <Plus className="w-4 h-4 mr-2" />
                        New Folder
                    </Button>
                </div>
            </div>

            {/* Breadcrumb Path */}
            <Card>
                <CardContent className="py-3">
                    <div className="flex items-center space-x-2 text-sm">
                        <span className="text-gray-500">Path:</span>
                        <span className="font-mono font-semibold">{currentPath}</span>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Files and Folders</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Size</TableHead>
                                <TableHead>Modified</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {currentFiles.map((file) => (
                                <TableRow key={file.id} className="group">
                                    <TableCell>
                                        <div className="flex items-center space-x-2">
                                            {file.type === 'directory' ? (
                                                <FolderOpen className="w-5 h-5 text-yellow-500" />
                                            ) : (
                                                <File className="w-5 h-5 text-gray-400" />
                                            )}
                                            <span className="font-medium">{file.name}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={file.type === 'directory' ? 'info' : 'default'}>
                                            {file.type === 'directory' ? 'Folder' : 'File'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {file.size !== undefined ? (
                                            <span className="text-sm">{formatBytes(file.size)}</span>
                                        ) : (
                                            <span className="text-gray-400">-</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-sm text-gray-600">
                                            {formatDateTime(file.modified)}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {file.type === 'file' && (
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    title="Download"
                                                >
                                                    <Download className="w-4 h-4" />
                                                </Button>
                                            )}
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => handleDelete(file.id)}
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

            {/* Storage Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-sm text-gray-600">Total Files</div>
                        <div className="text-2xl font-bold mt-1">{files.filter(f => f.type === 'file').length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-sm text-gray-600">Total Folders</div>
                        <div className="text-2xl font-bold mt-1">{files.filter(f => f.type === 'directory').length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-sm text-gray-600">Total Size</div>
                        <div className="text-2xl font-bold mt-1">
                            {formatBytes(files.reduce((acc, f) => acc + (f.size || 0), 0))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
