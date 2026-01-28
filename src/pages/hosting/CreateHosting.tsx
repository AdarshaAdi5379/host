import { useState } from 'react'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Server, Check } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@/components/ui/toast'

export function CreateHosting() {
    const navigate = useNavigate()
    const { addToast } = useToast()
    const [domain, setDomain] = useState('')
    const [selectedPlan, setSelectedPlan] = useState<string | null>(null)

    const handleCreate = () => {
        if (!domain || !selectedPlan) return

        addToast({
            title: 'Hosting Created',
            description: `Hosting account for ${domain} has been created`,
            variant: 'success',
        })
        navigate('/hosting')
    }

    const plans = [
        { id: 'shared', name: 'Shared Hosting', price: '$2.99/mo', description: 'Perfect for small websites' },
        { id: 'cloud', name: 'Cloud Hosting', price: '$9.99/mo', description: 'For high-traffic sites' },
        { id: 'vps', name: 'VPS Hosting', price: '$19.99/mo', description: 'Dedicated resources' },
    ]

    return (
        <div className="space-y-6">
            <Breadcrumbs items={[{ label: 'Hosting', to: '/hosting' }, { label: 'New Hosting' }]} />

            <div>
                <h1 className="text-3xl font-bold text-brand-navy">Create Hosting Account</h1>
                <p className="text-gray-600 mt-1">Deploy your website with our powerful hosting platform</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Domain Input */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">1. Choose a Domain</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Domain Name
                            </label>
                            <Input
                                placeholder="example.com"
                                value={domain}
                                onChange={(e) => setDomain(e.target.value)}
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Enter the domain you want to host
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Plan Selection */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">2. Select a Plan</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {plans.map((plan) => (
                            <div
                                key={plan.id}
                                className={`p-4 border rounded-lg cursor-pointer transition-colors ${selectedPlan === plan.id
                                        ? 'border-brand-purple bg-purple-50'
                                        : 'border-gray-200 hover:border-brand-purple'
                                    }`}
                                onClick={() => setSelectedPlan(plan.id)}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${selectedPlan === plan.id ? 'bg-brand-purple text-white' : 'bg-gray-100'
                                            }`}>
                                            <Server className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <h4 className="font-medium">{plan.name}</h4>
                                            <p className="text-xs text-gray-500">{plan.description}</p>
                                        </div>
                                    </div>
                                    <span className="font-bold text-brand-purple">{plan.price}</span>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </div>

            <div className="flex justify-end">
                <Button
                    variant="primary"
                    size="lg"
                    disabled={!domain || !selectedPlan}
                    onClick={handleCreate}
                >
                    <Check className="w-5 h-5 mr-2" />
                    Create Hosting Account
                </Button>
            </div>
        </div>
    )
}
