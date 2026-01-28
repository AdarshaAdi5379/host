import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toast'
import { Monitor, Chrome, Smartphone, MapPin, Clock } from 'lucide-react'
import type { Session } from '@/types/auth'

// Mock session data
const mockSessions: Session[] = [
    {
        id: '1',
        deviceName: 'Chrome on Windows',
        browser: 'Chrome 120',
        os: 'Windows 11',
        location: 'Bangalore, India',
        ipAddress: '103.21.244.0',
        lastActive: new Date().toISOString(),
        isCurrent: true,
    },
    {
        id: '2',
        deviceName: 'Safari on iPhone',
        browser: 'Safari 17',
        os: 'iOS 17',
        location: 'Mumbai, India',
        ipAddress: '103.21.245.12',
        lastActive: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        isCurrent: false,
    },
    {
        id: '3',
        deviceName: 'Firefox on macOS',
        browser: 'Firefox 121',
        os: 'macOS 14',
        location: 'Delhi, India',
        ipAddress: '103.21.246.24',
        lastActive: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        isCurrent: false,
    },
]

export function SessionManagement() {
    const { addToast } = useToast()

    const handleRevokeSession = (sessionId: string) => {
        // Mock revoke - replace with real API call
        console.log('Revoking session:', sessionId)
        addToast({
            title: 'Session Revoked',
            description: 'The session has been terminated successfully',
            variant: 'success',
        })
    }

    const handleLogoutEverywhere = () => {
        addToast({
            title: 'All Sessions Terminated',
            description: 'You have been logged out from all devices',
            variant: 'success',
        })
    }

    const formatLastActive = (timestamp: string) => {
        const date = new Date(timestamp)
        const now = new Date()
        const diffMs = now.getTime() - date.getTime()
        const diffMins = Math.floor(diffMs / 60000)
        const diffHours = Math.floor(diffMs / 3600000)
        const diffDays = Math.floor(diffMs / 86400000)

        if (diffMins < 1) return 'Just now'
        if (diffMins < 60) return `${diffMins} minutes ago`
        if (diffHours < 24) return `${diffHours} hours ago`
        return `${diffDays} days ago`
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-brand-navy">Active Sessions</h2>
                    <p className="text-gray-600 mt-1">
                        Manage devices where you're currently logged in
                    </p>
                </div>
                <Button variant="danger" onClick={handleLogoutEverywhere}>
                    Logout Everywhere
                </Button>
            </div>

            {/* Sessions List */}
            <div className="space-y-4">
                {mockSessions.map((session) => (
                    <Card key={session.id}>
                        <CardContent className="p-6">
                            <div className="flex items-start justify-between">
                                <div className="flex items-start space-x-4">
                                    {/* Device Icon */}
                                    <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                        {session.os.includes('iOS') || session.os.includes('Android') ? (
                                            <Smartphone className="w-6 h-6 text-brand-purple" />
                                        ) : (
                                            <Monitor className="w-6 h-6 text-brand-purple" />
                                        )}
                                    </div>

                                    {/* Session Details */}
                                    <div className="flex-1">
                                        <div className="flex items-center space-x-2 mb-2">
                                            <h3 className="font-semibold text-brand-navy">
                                                {session.deviceName}
                                            </h3>
                                            {session.isCurrent && (
                                                <Badge variant="success">Current Session</Badge>
                                            )}
                                        </div>

                                        <div className="space-y-1 text-sm text-gray-600">
                                            <div className="flex items-center space-x-2">
                                                <Chrome className="w-4 h-4" />
                                                <span>{session.browser} • {session.os}</span>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <MapPin className="w-4 h-4" />
                                                <span>{session.location} • {session.ipAddress}</span>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <Clock className="w-4 h-4" />
                                                <span>Last active {formatLastActive(session.lastActive)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Actions */}
                                {!session.isCurrent && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleRevokeSession(session.id)}
                                    >
                                        Revoke
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Info Card */}
            <Card>
                <CardHeader>
                    <CardTitle>Security Tips</CardTitle>
                </CardHeader>
                <CardContent>
                    <ul className="space-y-2 text-sm text-gray-600">
                        <li className="flex items-start space-x-2">
                            <span className="text-brand-purple mt-1">•</span>
                            <span>
                                If you see a session you don't recognize, revoke it immediately and change your password
                            </span>
                        </li>
                        <li className="flex items-start space-x-2">
                            <span className="text-brand-purple mt-1">•</span>
                            <span>
                                Use "Logout Everywhere" if you suspect unauthorized access to your account
                            </span>
                        </li>
                        <li className="flex items-start space-x-2">
                            <span className="text-brand-purple mt-1">•</span>
                            <span>
                                Enable two-factor authentication for an extra layer of security
                            </span>
                        </li>
                    </ul>
                </CardContent>
            </Card>
        </div>
    )
}
