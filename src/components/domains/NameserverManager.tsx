import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Server, CheckCircle } from 'lucide-react'
import { useToast } from '@/components/ui/toast'

export function NameserverManager() {
    const [mode, setMode] = useState<'system' | 'custom'>('system')
    const [nameservers, setNameservers] = useState({
        ns1: 'ns1.hostinger.com',
        ns2: 'ns2.hostinger.com',
        ns3: '',
        ns4: '',
    })
    const { addToast } = useToast()

    const handleSave = () => {
        addToast({
            title: 'Nameservers Updated',
            description: 'Your nameserver changes will propagate within 24-48 hours',
            variant: 'success',
        })
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                    <Server className="w-5 h-5 text-brand-purple" />
                    <span>Nameserver Management</span>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Mode Toggle */}
                <div className="flex space-x-4">
                    <button
                        onClick={() => setMode('system')}
                        className={`flex-1 p-4 border-2 rounded-lg transition-all ${mode === 'system'
                            ? 'border-brand-purple bg-purple-50'
                            : 'border-gray-200 hover:border-gray-300'
                            }`}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold">System Default</span>
                            {mode === 'system' && (
                                <CheckCircle className="w-5 h-5 text-brand-purple" />
                            )}
                        </div>
                        <p className="text-sm text-gray-600">Use Hostinger's nameservers</p>
                    </button>

                    <button
                        onClick={() => setMode('custom')}
                        className={`flex-1 p-4 border-2 rounded-lg transition-all ${mode === 'custom'
                            ? 'border-brand-purple bg-purple-50'
                            : 'border-gray-200 hover:border-gray-300'
                            }`}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold">Custom</span>
                            {mode === 'custom' && (
                                <CheckCircle className="w-5 h-5 text-brand-purple" />
                            )}
                        </div>
                        <p className="text-sm text-gray-600">Use your own nameservers</p>
                    </button>
                </div>

                {/* Nameserver Inputs */}
                {mode === 'system' ? (
                    <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="font-mono text-sm">ns1.hostinger.com</span>
                            <Badge variant="success">Active</Badge>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="font-mono text-sm">ns2.hostinger.com</span>
                            <Badge variant="success">Active</Badge>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-medium mb-2 block">
                                Nameserver 1 <span className="text-red-500">*</span>
                            </label>
                            <Input
                                value={nameservers.ns1}
                                onChange={(e) =>
                                    setNameservers({ ...nameservers, ns1: e.target.value })
                                }
                                placeholder="ns1.example.com"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-2 block">
                                Nameserver 2 <span className="text-red-500">*</span>
                            </label>
                            <Input
                                value={nameservers.ns2}
                                onChange={(e) =>
                                    setNameservers({ ...nameservers, ns2: e.target.value })
                                }
                                placeholder="ns2.example.com"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-2 block">
                                Nameserver 3 (Optional)
                            </label>
                            <Input
                                value={nameservers.ns3}
                                onChange={(e) =>
                                    setNameservers({ ...nameservers, ns3: e.target.value })
                                }
                                placeholder="ns3.example.com"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-2 block">
                                Nameserver 4 (Optional)
                            </label>
                            <Input
                                value={nameservers.ns4}
                                onChange={(e) =>
                                    setNameservers({ ...nameservers, ns4: e.target.value })
                                }
                                placeholder="ns4.example.com"
                            />
                        </div>
                    </div>
                )}

                {/* Save Button */}
                {mode === 'custom' && (
                    <Button variant="primary" onClick={handleSave} className="w-full">
                        Save Nameservers
                    </Button>
                )}

                {/* Propagation Notice */}
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-900">
                        <strong>Note:</strong> Nameserver changes can take 24-48 hours to propagate globally.
                    </p>
                </div>
            </CardContent>
        </Card>
    )
}
