export enum GitProvider {
    GITHUB = 'github',
    GITLAB = 'gitlab',
    BITBUCKET = 'bitbucket',
}

export interface Repository {
    id: string
    name: string
    fullName: string
    description: string
    url: string
    defaultBranch: string
    lastUpdated: string
    private: boolean
}

export interface BuildSettings {
    repositoryId: string
    branch: string
    buildCommand: string
    outputDirectory: string
    environmentVariables: Record<string, string>
    autoDeployOnPush: boolean
}

export enum DeploymentStatus {
    PENDING = 'pending',
    BUILDING = 'building',
    SUCCESS = 'success',
    FAILED = 'failed',
    CANCELLED = 'cancelled',
}

export interface Deployment {
    id: string
    repositoryName: string
    branch: string
    commitHash: string
    commitMessage: string
    status: DeploymentStatus
    startedAt: string
    completedAt?: string
    duration?: number
    logs: string[]
    url?: string
}

export interface BuildLog {
    timestamp: string
    message: string
    level: 'info' | 'error' | 'warning'
}

export interface GitProviderConnection {
    provider: GitProvider
    connected: boolean
    username?: string
    email?: string
    accessToken?: string
    connectedAt?: string
}

export interface FileUpload {
    id: string
    name: string
    size: number
    type: string
    progress: number
    status: 'pending' | 'uploading' | 'completed' | 'failed'
    url?: string
}
