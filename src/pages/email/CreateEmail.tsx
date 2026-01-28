import { useState } from 'react'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Mail, Check } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@/components/ui/toast'

export function CreateEmail() {
    const navigate = useNavigate()
    const { addToast } = useToast()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')

    const handleCreate = () => {
        if (!email || !password) return

        addToast({
            title: 'Email Account Created',
            description: `Email account ${email}@mywebsite.com created successfully`,
            variant: 'success',
        })
        navigate('/email')
    }

    return (
        <div className="space-y-6">
            <Breadcrumbs items={[{ label: 'Email', to: '/email' }, { label: 'New Account' }]} />

            <div>
                <h1 className="text-3xl font-bold text-brand-navy">Create Email Account</h1>
                <p className="text-gray-600 mt-1">Set up a professional email address for your domain</p>
            </div>

            <div className="max-w-2xl">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center space-x-2">
                            <Mail className="w-5 h-5 text-brand-purple" />
                            <span>Account Details</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-1">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Username
                                </label>
                                <Input
                                    placeholder="contact"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                            <div className="col-span-1 pt-7">
                                <span className="text-gray-500 font-medium">@ mywebsite.com</span>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Password
                            </label>
                            <Input
                                type="password"
                                placeholder="Min. 8 characters"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>

                        <div className="pt-4 flex justify-end">
                            <Button
                                variant="primary"
                                disabled={!email || !password}
                                onClick={handleCreate}
                            >
                                <Check className="w-4 h-4 mr-2" />
                                Create Account
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
