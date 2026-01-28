import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Github, GitBranch, RefreshCw, Layers, Terminal } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import type { BuildSettings } from '@/types/deployment'

interface GitConfigFormProps {
    onDeploy: (config: any) => void
    isDeploying: boolean
}

export function GitConfigForm({ onDeploy, isDeploying }: GitConfigFormProps) {
    const { addToast } = useToast()
    const [isConnected, setIsConnected] = useState(false)
    const [isConnecting, setIsConnecting] = useState(false)
    const [selectedRepo, setSelectedRepo] = useState<string>('')
    const [selectedBranch, setSelectedBranch] = useState('main')

    // Build Config State
    const [buildCmd, setBuildCmd] = useState('npm run build')
    const [outputDir, setOutputDir] = useState('dist')
    const [installCmd, setInstallCmd] = useState('npm install')
    const [autoDeploy, setAutoDeploy] = useState(true)

    // Mock Data
    const repos = ['my-portfolio', 'e-commerce-app', 'blog-starter', 'react-dashboard']
    const branches = ['main', 'develop', 'staging', 'feature/auth']

    const handleConnect = () => {
        setIsConnecting(true)
        // Simulate OAuth popup delay
        setTimeout(() => {
            setIsConnected(true)
            setIsConnecting(false)
            addToast({
                title: 'GitHub Connected',
                description: 'Successfully authorized access to your repositories',
                variant: 'success',
            })
        }, 1500)
    }

    const handleDeploy = () => {
        if (!selectedRepo) {
            addToast({
                title: 'Selection Required',
                description: 'Please select a repository to deploy',
                variant: 'error',
            })
            return
        }

        const config: BuildSettings = {
            repositoryId: selectedRepo,
            branch: selectedBranch,
            buildCommand: buildCmd,
            outputDirectory: outputDir,
            environmentVariables: {},
            autoDeployOnPush: autoDeploy,
        }

        onDeploy(config)
    }

    return (
        <div className="space-y-6">
            {/* Connection Status */}
            <Card className={isConnected ? 'border-green-200 bg-green-50/30' : ''}>
                <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                        <Github className="w-5 h-5" />
                        <span>Git Provider</span>
                    </CardTitle>
                    <CardDescription>
                        Connect your version control system to enable automatic deployments
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {!isConnected ? (
                        <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg bg-gray-50">
                            <Github className="w-12 h-12 text-gray-400 mb-4" />
                            <h3 className="font-semibold text-lg mb-2">Connect to GitHub</h3>
                            <p className="text-gray-500 text-sm text-center mb-6 max-w-md">
                                Grant access to your private and public repositories to start deploying your applications.
                            </p>
                            <Button
                                onClick={handleConnect}
                                disabled={isConnecting}
                                className="bg-[#24292e] hover:bg-[#2b3137] text-white"
                            >
                                {isConnecting ? (
                                    <>
                                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                        Connecting...
                                    </>
                                ) : (
                                    <>
                                        <Github className="w-4 h-4 mr-2" />
                                        Authorize with GitHub
                                    </>
                                )}
                            </Button>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between p-4 bg-white border rounded-lg shadow-sm">
                            <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 bg-gray-900 rounded-full flex items-center justify-center text-white">
                                    <Github className="w-6 h-6" />
                                </div>
                                <div>
                                    <div className="flex items-center space-x-2">
                                        <h4 className="font-semibold text-gray-900">GitHub</h4>
                                        <Badge variant="success" className="h-5">Connected</Badge>
                                    </div>
                                    <p className="text-sm text-gray-500">adarsh-kk</p>
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                onClick={() => setIsConnected(false)}
                            >
                                Disconnect
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Config Form - Only show if connected */}
            {isConnected && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Main Config */}
                    <div className="lg:col-span-2 space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Project Configuration</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {/* Repo & Branch */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium flex items-center">
                                            <Github className="w-4 h-4 mr-1 text-gray-500" />
                                            Repository
                                        </label>
                                        <select
                                            className="w-full h-10 px-3 rounded-md border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/20"
                                            value={selectedRepo}
                                            onChange={(e) => setSelectedRepo(e.target.value)}
                                        >
                                            <option value="">Select Repository...</option>
                                            {repos.map(r => (
                                                <option key={r} value={r}>{r}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium flex items-center">
                                            <GitBranch className="w-4 h-4 mr-1 text-gray-500" />
                                            Branch
                                        </label>
                                        <select
                                            className="w-full h-10 px-3 rounded-md border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/20"
                                            value={selectedBranch}
                                            onChange={(e) => setSelectedBranch(e.target.value)}
                                        >
                                            {branches.map(b => (
                                                <option key={b} value={b}>{b}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Build Settings */}
                                <div className="space-y-4 pt-4 border-t">
                                    <h4 className="font-medium flex items-center text-gray-900">
                                        <Terminal className="w-4 h-4 mr-2" />
                                        Build Settings
                                    </h4>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-gray-600">Install Command</label>
                                            <Input
                                                value={installCmd}
                                                onChange={(e) => setInstallCmd(e.target.value)}
                                                placeholder="npm install"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-gray-600">Build Command</label>
                                            <Input
                                                value={buildCmd}
                                                onChange={(e) => setBuildCmd(e.target.value)}
                                                placeholder="npm run build"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-gray-600">Output Directory</label>
                                            <Input
                                                value={outputDir}
                                                onChange={(e) => setOutputDir(e.target.value)}
                                                placeholder="dist"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Sidebar / Actions */}
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Deployment Trigger</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center justify-between p-3 border rounded-lg">
                                    <div className="space-y-0.5">
                                        <label className="text-sm font-medium text-gray-900">Auto-Deploy</label>
                                        <p className="text-xs text-gray-500">Deploy on push to {selectedBranch}</p>
                                    </div>
                                    <div
                                        className={`w-10 h-6 rounded-full p-1 cursor-pointer transition-colors ${autoDeploy ? 'bg-green-500' : 'bg-gray-300'
                                            }`}
                                        onClick={() => setAutoDeploy(!autoDeploy)}
                                    >
                                        <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${autoDeploy ? 'translate-x-4' : 'translate-x-0'
                                            }`} />
                                    </div>
                                </div>

                                <Button
                                    className="w-full"
                                    size="lg"
                                    onClick={handleDeploy}
                                    disabled={!selectedRepo || isDeploying}
                                >
                                    {isDeploying ? (
                                        <>
                                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                            Queueing Build...
                                        </>
                                    ) : (
                                        <>
                                            <Layers className="w-4 h-4 mr-2" />
                                            Trigger Deployment
                                        </>
                                    )}
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}
        </div>
    )
}
