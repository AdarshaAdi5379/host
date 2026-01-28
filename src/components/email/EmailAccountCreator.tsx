import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Mail, Key } from 'lucide-react'
import { useToast } from '@/components/ui/toast'

export function EmailAccountCreator() {
    const [formData, setFormData] = useState({
        username: '',
        domain: 'example.com',
        password: '',
        quota: 1024, // MB
    })
    const { addToast } = useToast()

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        addToast({
            title: 'Email Account Created',
            description: `${formData.username}@${formData.domain} has been created successfully`,
            variant: 'success',
        })
        setFormData({ ...formData, username: '', password: '' })
    }

    const generatePassword = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%'
        const password = Array.from({ length: 16 }, () =>
            chars.charAt(Math.floor(Math.random() * chars.length))
        ).join('')
        setFormData({ ...formData, password })
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                    <Mail className="w-5 h-5 text-brand-purple" />
                    <span>Create Email Account</span>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Email Address */}
                    <div>
                        <label className="text-sm font-medium mb-2 block">
                            Email Address <span className="text-red-500">*</span>
                        </label>
                        <div className="flex items-center space-x-2">
                            <Input
                                value={formData.username}
                                onChange={(e) =>
                                    setFormData({ ...formData, username: e.target.value })
                                }
                                placeholder="username"
                                required
                                className="flex-1"
                            />
                            <span className="text-gray-500">@</span>
                            <select
                                value={formData.domain}
                                onChange={(e) =>
                                    setFormData({ ...formData, domain: e.target.value })
                                }
                                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-purple"
                            >
                                <option>example.com</option>
                                <option>mysite.net</option>
                                <option>portfolio.io</option>
                            </select>
                        </div>
                    </div>

                    {/* Password */}
                    <div>
                        <label className="text-sm font-medium mb-2 block">
                            Password <span className="text-red-500">*</span>
                        </label>
                        <div className="flex items-center space-x-2">
                            <Input
                                type="password"
                                value={formData.password}
                                onChange={(e) =>
                                    setFormData({ ...formData, password: e.target.value })
                                }
                                placeholder="Enter password"
                                required
                                className="flex-1"
                            />
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={generatePassword}
                            >
                                <Key className="w-4 h-4 mr-2" />
                                Generate
                            </Button>
                        </div>
                    </div>

                    {/* Storage Quota */}
                    <div>
                        <label className="text-sm font-medium mb-2 block">
                            Storage Quota: {formData.quota} MB
                        </label>
                        <input
                            type="range"
                            min="100"
                            max="5000"
                            step="100"
                            value={formData.quota}
                            onChange={(e) =>
                                setFormData({ ...formData, quota: parseInt(e.target.value) })
                            }
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-brand-purple"
                        />
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                            <span>100 MB</span>
                            <span>5 GB</span>
                        </div>
                    </div>

                    {/* Submit Button */}
                    <Button type="submit" variant="primary" className="w-full">
                        Create Email Account
                    </Button>
                </form>
            </CardContent>
        </Card>
    )
}
