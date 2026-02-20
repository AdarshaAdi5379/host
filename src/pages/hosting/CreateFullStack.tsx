import { useState } from 'react'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Check, Loader2, Plus, Trash2, Github } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@/components/ui/toast'
import { wordpressAPI } from '@/lib/wordpressAPI'

export function CreateFullStack() {
    const navigate = useNavigate()
    const { addToast } = useToast()

    // Form State
    const [siteName, setSiteName] = useState('')
    const [repoUrl, setRepoUrl] = useState('')
    const [branch, setBranch] = useState('main')
    const [envVars, setEnvVars] = useState<{ key: string; value: string }[]>([])
    const [isCreating, setIsCreating] = useState(false)

    // Environment Variable Handlers
    const addEnvVar = () => {
        setEnvVars([...envVars, { key: '', value: '' }])
    }

    const removeEnvVar = (index: number) => {
        setEnvVars(envVars.filter((_, i) => i !== index))
    }

    const updateEnvVar = (index: number, field: 'key' | 'value', value: string) => {
        const newEnvVars = [...envVars]
        newEnvVars[index][field] = value
        setEnvVars(newEnvVars)
    }

    const handleCreate = async () => {
        // Validation
        if (!siteName || !repoUrl) {
            addToast({
                title: 'Validation Error',
                description: 'Site Name and Repository URL are required',
                variant: 'error',
            })
            return
        }

        // Validate Repo URL format
        const urlPattern = /^(https?:\/\/|git@).+/i
        if (!urlPattern.test(repoUrl)) {
            addToast({
                title: 'Invalid URL',
                description: 'Repository URL must start with http://, https://, or git@',
                variant: 'error',
            })
            return
        }

        // Convert Env Vars Array to Object
        const envVarsObj: Record<string, string> = {}
        envVars.forEach(({ key, value }) => {
            if (key) envVarsObj[key] = value
        })

        setIsCreating(true)

        try {
            await wordpressAPI.createSite({
                name: siteName,
                framework: 'react_django',
                repo_url: repoUrl,
                branch: branch,
                env_vars: envVarsObj,
                admin_username: 'admin', // defaulted for now
                admin_password: 'password' // defaulted for now
            })

            addToast({
                title: 'Deployment Started!',
                description: `${siteName} is building. This may take a few minutes.`,
                variant: 'success',
            })

            navigate('/hosting')
        } catch (error) {
            addToast({
                title: 'Deployment Failed',
                description: error instanceof Error ? error.message : 'Failed to deploy application',
                variant: 'error',
            })
        } finally {
            setIsCreating(false)
        }
    }

    return (
        <div className="space-y-6">
            <Breadcrumbs items={[{ label: 'Hosting', to: '/hosting' }, { label: 'New Full Stack App' }]} />

            <div>
                <h1 className="text-3xl font-bold text-brand-navy">Deploy Full Stack App</h1>
                <p className="text-gray-600 mt-1">Deploy React + Django applications directly from GitHub</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Configuration */}
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Project Configuration</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Site Name */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    project-name
                                </label>
                                <Input
                                    placeholder="my-awesome-app"
                                    value={siteName}
                                    onChange={(e) => setSiteName(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ''))}
                                    disabled={isCreating}
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Will be accessible at <span className="font-mono">{siteName || 'app'}.local</span>
                                </p>
                            </div>

                            {/* Repo URL */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    GitHub Repository URL
                                </label>
                                <div className="flex gap-2">
                                    <div className="flex items-center justify-center w-10 bg-gray-100 rounded-md border border-gray-200">
                                        <Github className="w-5 h-5 text-gray-500" />
                                    </div>
                                    <Input
                                        placeholder="https://github.com/username/repo"
                                        value={repoUrl}
                                        onChange={(e) => setRepoUrl(e.target.value)}
                                        disabled={isCreating}
                                    />
                                </div>
                            </div>

                            {/* Branch */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Branch
                                </label>
                                <Input
                                    placeholder="main"
                                    value={branch}
                                    onChange={(e) => setBranch(e.target.value)}
                                    disabled={isCreating}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Environment Variables */}
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <CardTitle>Environment Variables</CardTitle>
                                <Button variant="outline" size="sm" onClick={addEnvVar} disabled={isCreating}>
                                    <Plus className="w-4 h-4 mr-2" />
                                    Add Variable
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {envVars.length === 0 && (
                                    <p className="text-sm text-gray-500 italic text-center py-4">
                                        No environment variables configured.
                                    </p>
                                )}
                                {envVars.map((env, index) => (
                                    <div key={index} className="flex gap-3">
                                        <Input
                                            placeholder="KEY"
                                            value={env.key}
                                            onChange={(e) => updateEnvVar(index, 'key', e.target.value)}
                                            disabled={isCreating}
                                            className="font-mono"
                                        />
                                        <Input
                                            placeholder="VALUE"
                                            value={env.value}
                                            onChange={(e) => updateEnvVar(index, 'value', e.target.value)}
                                            disabled={isCreating}
                                            type="password"
                                        />
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => removeEnvVar(index)}
                                            disabled={isCreating}
                                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Sidebar Info */}
                <div className="space-y-6">
                    <Card className="bg-blue-50 border-blue-100">
                        <CardHeader>
                            <CardTitle className="text-blue-900">Deployment Info</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-blue-800 space-y-3">
                            <p>
                                <strong>Architecture:</strong> Your app will be deployed as two separate containers (Frontend + Backend) along with a dedicated Database.
                            </p>
                            <p>
                                <strong>Auto-Detection:</strong> We look for <code>package.json</code> for React and <code>manage.py</code> for Django.
                            </p>
                            <p>
                                <strong>Ports:</strong> Two ports will be allocated. The frontend port will be the main entry point.
                            </p>
                        </CardContent>
                    </Card>

                    <Button
                        className="w-full"
                        variant="primary"
                        size="lg"
                        disabled={!siteName || !repoUrl || isCreating}
                        onClick={handleCreate}
                    >
                        {isCreating ? (
                            <>
                                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                Deploying...
                            </>
                        ) : (
                            <>
                                <Check className="w-5 h-5 mr-2" />
                                Deploy Application
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    )
}
