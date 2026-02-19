import { useState } from 'react'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Check, Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@/components/ui/toast'
import { wordpressAPI } from '@/lib/wordpressAPI'

export function CreateHosting() {
    const navigate = useNavigate()
    const { addToast } = useToast()
    const [siteName, setSiteName] = useState('')
    const [adminUsername, setAdminUsername] = useState('admin')
    const [adminPassword, setAdminPassword] = useState('')
    const [isCreating, setIsCreating] = useState(false)

    const handleCreate = async () => {
        if (!siteName || !adminUsername || !adminPassword) {
            addToast({
                title: 'Validation Error',
                description: 'Please fill in all fields',
                variant: 'error',
            })
            return
        }

        setIsCreating(true)

        try {
            const site = await wordpressAPI.createSite({
                name: siteName,
                admin_username: adminUsername,
                admin_password: adminPassword,
            })

            addToast({
                title: 'WordPress Site Created!',
                description: `${site.domain} is starting on port ${site.port}. WordPress setup runs in the background — the login page will be ready in ~60 seconds.`,
                variant: 'success',
            })

            navigate('/hosting')
        } catch (error) {
            addToast({
                title: 'Creation Failed',
                description: error instanceof Error ? error.message : 'Failed to create WordPress site',
                variant: 'error',
            })
        } finally {
            setIsCreating(false)
        }
    }

    return (
        <div className="space-y-6">
            <Breadcrumbs items={[{ label: 'Hosting', to: '/hosting' }, { label: 'New WordPress Site' }]} />

            <div>
                <h1 className="text-3xl font-bold text-brand-navy">Create WordPress Site</h1>
                <p className="text-gray-600 mt-1">Deploy a local WordPress instance with one click</p>
            </div>

            <div className="max-w-2xl">
                <Card>
                    <CardHeader>
                        <CardTitle>Site Configuration</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Site Name */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Site Name
                            </label>
                            <Input
                                placeholder="mysite"
                                value={siteName}
                                onChange={(e) => setSiteName(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ''))}
                                disabled={isCreating}
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Will be accessible at: <span className="font-mono">{siteName || 'mysite'}.local</span>
                            </p>
                        </div>

                        {/* Admin Username */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                WordPress Admin Username
                            </label>
                            <Input
                                placeholder="admin"
                                value={adminUsername}
                                onChange={(e) => setAdminUsername(e.target.value)}
                                disabled={isCreating}
                            />
                        </div>

                        {/* Admin Password */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                WordPress Admin Password
                            </label>
                            <Input
                                type="password"
                                placeholder="Enter a secure password"
                                value={adminPassword}
                                onChange={(e) => setAdminPassword(e.target.value)}
                                disabled={isCreating}
                            />
                        </div>

                        {/* Create Button */}
                        <div className="flex justify-end pt-4">
                            <Button
                                variant="primary"
                                size="lg"
                                disabled={!siteName || !adminUsername || !adminPassword || isCreating}
                                onClick={handleCreate}
                            >
                                {isCreating ? (
                                    <>
                                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                        Creating Site...
                                    </>
                                ) : (
                                    <>
                                        <Check className="w-5 h-5 mr-2" />
                                        Create WordPress Site
                                    </>
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
