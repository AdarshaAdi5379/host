import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
    FolderOpen,
    ExternalLink,
    HardDrive,
    AlertTriangle,
    Info,
    Copy,
    Eye,
    EyeOff,
    CheckCircle2
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { fileManagerAPI, type FileManagerAccess } from '@/lib/api/fileManager'

interface FileManagerTabProps {
    siteId: number
}

export function FileManagerTab({ siteId }: FileManagerTabProps) {
    const { token } = useAuthStore()
    const [access, setAccess] = useState<FileManagerAccess | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [showPassword, setShowPassword] = useState(false)
    const [copiedField, setCopiedField] = useState<string | null>(null)

    useEffect(() => {
        fetchAccess()
    }, [siteId])

    const fetchAccess = async () => {
        if (!token) return

        try {
            setLoading(true)
            setError(null)
            const data = await fileManagerAPI.getAccess(siteId, token)
            setAccess(data)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load file manager access')
        } finally {
            setLoading(false)
        }
    }

    const openFileManager = () => {
        if (access) {
            // Deep link directly to the site's directory
            // access.path is like "/srv/test33", FileBrowser root is /srv, so we need /files/test33/
            const sitePath = access.path.replace('/srv/', '')
            window.open(`${access.url}/files/${sitePath}/`, '_blank', 'noopener,noreferrer')
        }
    }

    const copyToClipboard = async (text: string, field: string) => {
        try {
            await navigator.clipboard.writeText(text)
            setCopiedField(field)
            setTimeout(() => setCopiedField(null), 2000)
        } catch (err) {
            console.error('Failed to copy:', err)
        }
    }

    const diskPercentage = access
        ? Math.round((access.disk_usage.used / access.disk_usage.total) * 100)
        : 0

    if (loading) {
        return (
            <Card>
                <CardContent className="p-12 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-purple mx-auto"></div>
                    <p className="text-gray-600 mt-4">Loading file manager access...</p>
                </CardContent>
            </Card>
        )
    }

    if (error) {
        return (
            <Card>
                <CardContent className="p-12 text-center">
                    <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <p className="text-red-600 font-semibold mb-2">Error</p>
                    <p className="text-gray-600">{error}</p>
                    <Button onClick={fetchAccess} variant="outline" className="mt-4">
                        Try Again
                    </Button>
                </CardContent>
            </Card>
        )
    }

    if (!access) return null

    const CredentialRow = ({ label, value, field, secret = false }: {
        label: string
        value: string
        field: string
        secret?: boolean
    }) => (
        <div className="flex items-center justify-between gap-3 py-2">
            <div className="flex-1 min-w-0">
                <label className="text-sm font-medium text-gray-700">{label}</label>
                <code className="mt-1 block px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm font-mono break-all">
                    {secret && !showPassword ? '••••••••••••' : value}
                </code>
            </div>
            <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(value, field)}
                className="shrink-0"
            >
                {copiedField === field ? (
                    <>
                        <CheckCircle2 className="w-4 h-4 mr-1 text-green-600" />
                        Copied
                    </>
                ) : (
                    <>
                        <Copy className="w-4 h-4 mr-1" />
                        Copy
                    </>
                )}
            </Button>
        </div>
    )

    return (
        <div className="space-y-6">
            {/* Warning Alert */}
            <div className="flex gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-800">
                    <strong>Important:</strong> File operations directly affect your live website.
                    Always backup before making changes. Delete operations are currently disabled for safety.
                </div>
            </div>

            {/* Access Card */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FolderOpen className="w-5 h-5 text-brand-purple" />
                        File Manager Access
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* URL and Path */}
                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-medium text-gray-700">File Manager URL</label>
                            <div className="mt-1 flex items-center gap-2">
                                <code className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm font-mono">
                                    {access.url}
                                </code>
                            </div>
                        </div>

                        <div>
                            <label className="text-sm font-medium text-gray-700">Site Path</label>
                            <div className="mt-1">
                                <code className="block px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm font-mono">
                                    {access.path}
                                </code>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                                Navigate to this folder after logging in
                            </p>
                        </div>

                        <div>
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-gray-700">Login Credentials</label>
                                {access.password && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setShowPassword(!showPassword)}
                                    >
                                        {showPassword ? (
                                            <>
                                                <EyeOff className="w-4 h-4 mr-1" />
                                                Hide Password
                                            </>
                                        ) : (
                                            <>
                                                <Eye className="w-4 h-4 mr-1" />
                                                Show Password
                                            </>
                                        )}
                                    </Button>
                                )}
                            </div>

                            <div className="mt-1">
                                {access.username && access.password ? (
                                    <div className="border border-gray-200 rounded-md px-3 py-1">
                                        <CredentialRow label="Username" value={access.username} field="username" />
                                        <CredentialRow label="Password" value={access.password} field="password" secret />
                                    </div>
                                ) : (
                                    <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                                        <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 shrink-0" />
                                        <p className="text-xs text-yellow-800">
                                            Credentials are not available yet for this site. Refresh this page after the
                                            site provisioning completes.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Disk Usage */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <HardDrive className="w-4 h-4 text-gray-500" />
                                <span className="text-sm font-medium text-gray-700">Disk Usage</span>
                            </div>
                            <span className="text-sm font-semibold text-gray-900">
                                {access.disk_usage.used_mb} MB / {Math.round(access.disk_usage.total / (1024 * 1024 * 1024))} GB
                            </span>
                        </div>
                        <Progress
                            value={diskPercentage}
                            variant={diskPercentage > 80 ? 'danger' : diskPercentage > 60 ? 'warning' : 'primary'}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            {diskPercentage}% used ({access.disk_usage.used_gb} GB)
                        </p>
                    </div>

                    {/* Open Button */}
                    <Button
                        onClick={openFileManager}
                        className="w-full"
                        size="lg"
                    >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Open File Manager
                    </Button>
                </CardContent>
            </Card>

            {/* Instructions Card */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Info className="w-5 h-5 text-blue-600" />
                        Common Tasks
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4 text-sm">
                        <div>
                            <h4 className="font-semibold text-gray-900 mb-1">Upload Theme/Plugin</h4>
                            <ol className="list-decimal list-inside text-gray-600 space-y-1 ml-2">
                                <li>Navigate to <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">wp-content/themes/</code> or <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">wp-content/plugins/</code></li>
                                <li>Click "Upload" and select your .zip file</li>
                                <li>Right-click the .zip file and select "Extract"</li>
                            </ol>
                        </div>

                        <div>
                            <h4 className="font-semibold text-gray-900 mb-1">Disable Broken Plugin</h4>
                            <ol className="list-decimal list-inside text-gray-600 space-y-1 ml-2">
                                <li>Navigate to <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">wp-content/plugins/</code></li>
                                <li>Find the problematic plugin folder</li>
                                <li>Right-click and rename it (e.g., add <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">.disabled</code> suffix)</li>
                            </ol>
                        </div>

                        <div>
                            <h4 className="font-semibold text-gray-900 mb-1">Edit Configuration</h4>
                            <ol className="list-decimal list-inside text-gray-600 space-y-1 ml-2">
                                <li>Locate <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">wp-config.php</code> in the root folder</li>
                                <li>Click the file to open the editor</li>
                                <li>Make your changes and click "Save"</li>
                            </ol>
                        </div>

                        <div>
                            <h4 className="font-semibold text-gray-900 mb-1">Download Backup</h4>
                            <ol className="list-decimal list-inside text-gray-600 space-y-1 ml-2">
                                <li>Select files/folders you want to backup</li>
                                <li>Click "Download" to save locally</li>
                                <li>Or use "Compress" to create a .zip archive first</li>
                            </ol>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
