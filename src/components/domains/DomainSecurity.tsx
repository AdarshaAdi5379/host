import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Lock, Unlock, Copy, Eye, EyeOff } from 'lucide-react'
import { useToast } from '@/components/ui/toast'

export function DomainSecurity() {
    const [transferLock, setTransferLock] = useState(true)
    const [whoisPrivacy, setWhoisPrivacy] = useState(true)
    const [showAuthCode, setShowAuthCode] = useState(false)
    const authCode = 'EPP-AUTH-CODE-12345-ABCDE'
    const { addToast } = useToast()

    const handleToggleTransferLock = () => {
        setTransferLock(!transferLock)
        addToast({
            title: transferLock ? 'Transfer Lock Disabled' : 'Transfer Lock Enabled',
            description: transferLock
                ? 'Your domain can now be transferred to another registrar'
                : 'Your domain is protected from unauthorized transfers',
            variant: transferLock ? 'warning' : 'success',
        })
    }

    const handleToggleWhoisPrivacy = () => {
        setWhoisPrivacy(!whoisPrivacy)
        addToast({
            title: whoisPrivacy ? 'WHOIS Privacy Disabled' : 'WHOIS Privacy Enabled',
            description: whoisPrivacy
                ? 'Your contact information is now public'
                : 'Your contact information is now protected',
            variant: whoisPrivacy ? 'warning' : 'success',
        })
    }

    const handleCopyAuthCode = () => {
        navigator.clipboard.writeText(authCode)
        addToast({
            title: 'Auth Code Copied',
            description: 'EPP/Auth code has been copied to clipboard',
            variant: 'success',
        })
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                    <Lock className="w-5 h-5 text-brand-purple" />
                    <span>Domain Security & Transfer</span>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Transfer Lock */}
                <div className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-start justify-between mb-3">
                        <div className="flex items-start space-x-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${transferLock ? 'bg-green-100' : 'bg-red-100'
                                }`}>
                                {transferLock ? (
                                    <Lock className="w-5 h-5 text-green-600" />
                                ) : (
                                    <Unlock className="w-5 h-5 text-red-600" />
                                )}
                            </div>
                            <div>
                                <h4 className="font-medium mb-1">Transfer Lock</h4>
                                <p className="text-sm text-gray-600">
                                    Prevent unauthorized domain transfers
                                </p>
                                <Badge variant={transferLock ? 'success' : 'error'} className="mt-2">
                                    {transferLock ? 'Locked' : 'Unlocked'}
                                </Badge>
                            </div>
                        </div>
                        <button
                            onClick={handleToggleTransferLock}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${transferLock ? 'bg-brand-purple' : 'bg-gray-300'
                                }`}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${transferLock ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                            />
                        </button>
                    </div>
                </div>

                {/* Auth/EPP Code */}
                <div className="p-4 border border-gray-200 rounded-lg">
                    <h4 className="font-medium mb-3">Authorization (EPP) Code</h4>
                    <p className="text-sm text-gray-600 mb-3">
                        Required for transferring your domain to another registrar
                    </p>
                    <div className="flex items-center space-x-2">
                        <div className="flex-1 p-3 bg-gray-50 rounded font-mono text-sm">
                            {showAuthCode ? authCode : '••••••••••••••••••••••••'}
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowAuthCode(!showAuthCode)}
                        >
                            {showAuthCode ? (
                                <EyeOff className="w-4 h-4" />
                            ) : (
                                <Eye className="w-4 h-4" />
                            )}
                        </Button>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={handleCopyAuthCode}
                        >
                            <Copy className="w-4 h-4 mr-2" />
                            Copy
                        </Button>
                    </div>
                </div>

                {/* WHOIS Privacy */}
                <div className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-start justify-between">
                        <div>
                            <h4 className="font-medium mb-1">WHOIS Privacy Protection</h4>
                            <p className="text-sm text-gray-600 mb-2">
                                Hide your personal information from public WHOIS database
                            </p>
                            <Badge variant={whoisPrivacy ? 'success' : 'warning'}>
                                {whoisPrivacy ? 'Protected' : 'Public'}
                            </Badge>
                        </div>
                        <button
                            onClick={handleToggleWhoisPrivacy}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${whoisPrivacy ? 'bg-brand-purple' : 'bg-gray-300'
                                }`}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${whoisPrivacy ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                            />
                        </button>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
