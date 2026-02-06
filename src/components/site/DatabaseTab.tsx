import { useState, useEffect } from 'react'
import { Database, Copy, ExternalLink, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { wordpressAPI, type DatabaseCredentials } from '@/lib/api/wordpress'
import { useAuthStore } from '@/store/authStore'

interface DatabaseTabProps {
    siteId: number
}

export function DatabaseTab({ siteId }: DatabaseTabProps) {
    const { token } = useAuthStore()
    const [credentials, setCredentials] = useState<DatabaseCredentials | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [showPassword, setShowPassword] = useState(false)
    const [copiedField, setCopiedField] = useState<string | null>(null)

    useEffect(() => {
        fetchCredentials()
    }, [siteId])

    const fetchCredentials = async () => {
        if (!token) return

        try {
            setLoading(true)
            setError(null)
            const data = await wordpressAPI.getDatabaseCredentials(siteId, token)
            setCredentials(data)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load database credentials')
        } finally {
            setLoading(false)
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

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-purple"></div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                <div>
                    <h3 className="font-semibold text-red-900">Error Loading Credentials</h3>
                    <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
            </div>
        )
    }

    if (!credentials) {
        return (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div>
                    <h3 className="font-semibold text-yellow-900">No Database Credentials</h3>
                    <p className="text-sm text-yellow-700 mt-1">
                        Database credentials are not available for this site.
                    </p>
                </div>
            </div>
        )
    }

    const CredentialRow = ({ label, value, field, secret = false }: {
        label: string
        value: string
        field: string
        secret?: boolean
    }) => (
        <div className="flex items-center justify-between py-3 border-b border-gray-200 last:border-0">
            <div className="flex-1">
                <label className="text-sm font-medium text-gray-700">{label}</label>
                <div className="mt-1 flex items-center gap-2">
                    <code className="text-sm bg-gray-100 px-3 py-1.5 rounded font-mono text-gray-900">
                        {secret && !showPassword ? '••••••••••••' : value}
                    </code>
                </div>
            </div>
            <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(value, field)}
                className="ml-4"
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
            {/* Warning Banner */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
                <Database className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                    <h3 className="font-semibold text-blue-900">Database Access</h3>
                    <p className="text-sm text-blue-700 mt-1">
                        Use these credentials to access your WordPress database through Adminer.
                        Be careful when modifying database tables directly.
                    </p>
                </div>
            </div>

            {/* Credentials Card */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">Connection Details</h3>
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
                </div>

                <div className="px-6 py-2">
                    <CredentialRow label="Server / Host" value={credentials.host} field="host" />
                    <CredentialRow label="Database Name" value={credentials.database} field="database" />
                    <CredentialRow label="Username" value={credentials.username} field="username" />
                    <CredentialRow label="Password" value={credentials.password} field="password" secret />
                    <CredentialRow label="Port" value={credentials.port.toString()} field="port" />
                </div>
            </div>

            {/* Action Button */}
            <div className="flex items-center justify-between bg-gradient-to-r from-brand-purple to-purple-600 rounded-lg p-6 text-white">
                <div>
                    <h3 className="font-semibold text-lg">Open Database Manager</h3>
                    <p className="text-sm text-purple-100 mt-1">
                        Access Adminer to manage your database tables, run queries, and export data
                    </p>
                </div>
                <Button
                    onClick={() => window.open(credentials.adminer_url, '_blank')}
                    className="bg-white text-brand-purple hover:bg-gray-100"
                >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Open Adminer
                </Button>
            </div>

            {/* Instructions */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-3">How to Connect:</h4>
                <ol className="space-y-2 text-sm text-gray-700">
                    <li className="flex gap-2">
                        <span className="font-semibold text-brand-purple">1.</span>
                        <span>Click "Open Adminer" to launch the database manager in a new tab</span>
                    </li>
                    <li className="flex gap-2">
                        <span className="font-semibold text-brand-purple">2.</span>
                        <span>Copy and paste the Server, Username, and Password from above</span>
                    </li>
                    <li className="flex gap-2">
                        <span className="font-semibold text-brand-purple">3.</span>
                        <span>Select "MySQL" as the system and click "Login"</span>
                    </li>
                    <li className="flex gap-2">
                        <span className="font-semibold text-brand-purple">4.</span>
                        <span>You'll see your WordPress tables (wp_posts, wp_users, etc.)</span>
                    </li>
                </ol>
            </div>
        </div>
    )
}
