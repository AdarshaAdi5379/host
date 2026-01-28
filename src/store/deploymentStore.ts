import { create } from 'zustand'
import type {
    GitProviderConnection,
    Repository,
    BuildSettings,
    Deployment,
    GitProvider,
} from '@/types/deployment'

interface DeploymentState {
    gitConnections: GitProviderConnection[]
    selectedRepository: Repository | null
    buildSettings: BuildSettings | null
    deployments: Deployment[]
    currentDeployment: Deployment | null

    connectProvider: (provider: GitProvider, username: string, email: string, token: string) => void
    disconnectProvider: (provider: GitProvider) => void
    setSelectedRepository: (repository: Repository | null) => void
    setBuildSettings: (settings: BuildSettings) => void
    addDeployment: (deployment: Deployment) => void
    updateDeployment: (id: string, updates: Partial<Deployment>) => void
    setCurrentDeployment: (deployment: Deployment | null) => void
}

export const useDeploymentStore = create<DeploymentState>((set) => ({
    gitConnections: [],
    selectedRepository: null,
    buildSettings: null,
    deployments: [],
    currentDeployment: null,

    connectProvider: (provider, username, email, token) =>
        set((state) => ({
            gitConnections: [
                ...state.gitConnections.filter((conn) => conn.provider !== provider),
                {
                    provider,
                    connected: true,
                    username,
                    email,
                    accessToken: token,
                    connectedAt: new Date().toISOString(),
                },
            ],
        })),

    disconnectProvider: (provider) =>
        set((state) => ({
            gitConnections: state.gitConnections.filter((conn) => conn.provider !== provider),
        })),

    setSelectedRepository: (repository) =>
        set({ selectedRepository: repository }),

    setBuildSettings: (settings) =>
        set({ buildSettings: settings }),

    addDeployment: (deployment) =>
        set((state) => ({
            deployments: [deployment, ...state.deployments],
        })),

    updateDeployment: (id, updates) =>
        set((state) => ({
            deployments: state.deployments.map((dep) =>
                dep.id === id ? { ...dep, ...updates } : dep
            ),
            currentDeployment:
                state.currentDeployment?.id === id
                    ? { ...state.currentDeployment, ...updates }
                    : state.currentDeployment,
        })),

    setCurrentDeployment: (deployment) =>
        set({ currentDeployment: deployment }),
}))
