import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Shield, CheckCircle, AlertTriangle } from 'lucide-react'
import { useToast } from '@/components/ui/toast'

interface SecurityRecord {
    type: 'DKIM' | 'SPF' | 'DMARC'
    status: 'active' | 'missing' | 'invalid'
    value?: string
}

export function EmailSecurity() {
    const { addToast } = useToast()

    const records: SecurityRecord[] = [
        {
            type: 'DKIM',
            status: 'active',
            value: 'v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA...',
        },
        {
            type: 'SPF',
            status: 'active',
            value: 'v=spf1 include:_spf.hostinger.com ~all',
        },
        {
            type: 'DMARC',
            status: 'missing',
        },
    ]

    const handleGenerate = (type: string) => {
        addToast({
            title: `${type} Record Generated`,
            description: `Add the generated record to your DNS zone`,
            variant: 'success',
        })
    }

    const getStatusIcon = (status: SecurityRecord['status']) => {
        switch (status) {
            case 'active':
                return <CheckCircle className="w-5 h-5 text-green-600" />
            case 'missing':
                return <AlertTriangle className="w-5 h-5 text-yellow-600" />
            case 'invalid':
                return <AlertTriangle className="w-5 h-5 text-red-600" />
        }
    }

    const getStatusBadge = (status: SecurityRecord['status']) => {
        const variants = {
            active: 'success',
            missing: 'warning',
            invalid: 'error',
        } as const
        return variants[status]
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                    <Shield className="w-5 h-5 text-brand-purple" />
                    <span>Email Security & Deliverability</span>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {records.map((record) => (
                    <div
                        key={record.type}
                        className="p-4 border border-gray-200 rounded-lg"
                    >
                        <div className="flex items-start justify-between mb-3">
                            <div className="flex items-start space-x-3">
                                {getStatusIcon(record.status)}
                                <div>
                                    <h4 className="font-medium mb-1">{record.type}</h4>
                                    <Badge variant={getStatusBadge(record.status)}>
                                        {record.status}
                                    </Badge>
                                </div>
                            </div>
                            {record.status !== 'active' && (
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => handleGenerate(record.type)}
                                >
                                    Generate
                                </Button>
                            )}
                        </div>

                        {record.value && (
                            <div className="mt-3 p-3 bg-gray-50 rounded font-mono text-xs overflow-x-auto">
                                {record.value}
                            </div>
                        )}

                        {/* Description */}
                        <p className="text-sm text-gray-600 mt-3">
                            {record.type === 'DKIM' &&
                                'DomainKeys Identified Mail - Verifies email authenticity'}
                            {record.type === 'SPF' &&
                                'Sender Policy Framework - Prevents email spoofing'}
                            {record.type === 'DMARC' &&
                                'Domain-based Message Authentication - Protects against phishing'}
                        </p>
                    </div>
                ))}

                {/* Spam Filter Settings */}
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="font-medium mb-2">Spam Filter</h4>
                    <p className="text-sm text-gray-600 mb-3">
                        Automatically filter spam and suspicious emails
                    </p>
                    <div className="flex items-center justify-between">
                        <Badge variant="success">Active</Badge>
                        <Button variant="ghost" size="sm">
                            Configure
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
