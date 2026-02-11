import { useState } from 'react'
import { X, Copy, Check, ExternalLink, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { copyToClipboard } from '@/lib/clipboardUtils'

interface FileBrowserCredentialsModalProps {
    isOpen: boolean
    onClose: () => void
    credentials: {
        username: string
        password: string
        url: string
    }
}

export default function FileBrowserCredentialsModal({
    isOpen,
    onClose,
    credentials
}: FileBrowserCredentialsModalProps) {
    const [showPassword, setShowPassword] = useState(false)
    const [copiedField, setCopiedField] = useState<string | null>(null)

    if (!isOpen) return null

    const handleCopy = async (text: string, field: string) => {
        const success = await copyToClipboard(text)
        if (success) {
            setCopiedField(field)
            setTimeout(() => setCopiedField(null), 2000)
        }
    }

    const handleOpenFileManager = () => {
        window.open(credentials.url, '_blank')
        onClose()
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
            <div
                className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b">
                    <h2 className="text-xl font-semibold text-brand-navy">File Manager Access</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    <p className="text-sm text-gray-600">
                        Use these credentials to log into the File Manager and access your site's files.
                    </p>

                    {/* Username */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Username
                        </label>
                        <div className="flex items-center space-x-2">
                            <input
                                type="text"
                                value={credentials.username}
                                readOnly
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 font-mono text-sm"
                            />
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleCopy(credentials.username, 'username')}
                            >
                                {copiedField === 'username' ? (
                                    <Check className="w-4 h-4 text-green-600" />
                                ) : (
                                    <Copy className="w-4 h-4" />
                                )}
                            </Button>
                        </div>
                    </div>

                    {/* Password */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Password
                        </label>
                        <div className="flex items-center space-x-2">
                            <div className="flex-1 relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={credentials.password}
                                    readOnly
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 font-mono text-sm pr-10"
                                />
                                <button
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    {showPassword ? (
                                        <EyeOff className="w-4 h-4" />
                                    ) : (
                                        <Eye className="w-4 h-4" />
                                    )}
                                </button>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleCopy(credentials.password, 'password')}
                            >
                                {copiedField === 'password' ? (
                                    <Check className="w-4 h-4 text-green-600" />
                                ) : (
                                    <Copy className="w-4 h-4" />
                                )}
                            </Button>
                        </div>
                    </div>

                    {/* URL */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            File Manager URL
                        </label>
                        <div className="flex items-center space-x-2">
                            <input
                                type="text"
                                value={credentials.url}
                                readOnly
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 font-mono text-sm"
                            />
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleCopy(credentials.url, 'url')}
                            >
                                {copiedField === 'url' ? (
                                    <Check className="w-4 h-4 text-green-600" />
                                ) : (
                                    <Copy className="w-4 h-4" />
                                )}
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end space-x-3 p-6 border-t bg-gray-50">
                    <Button variant="outline" onClick={onClose}>
                        Close
                    </Button>
                    <Button variant="primary" onClick={handleOpenFileManager}>
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Open File Manager
                    </Button>
                </div>
            </div>
        </div>
    )
}
