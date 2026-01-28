import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FileX, Database, Inbox, FolderOpen } from 'lucide-react'

interface EmptyStateProps {
    icon?: React.ReactNode
    title: string
    description: string
    action?: {
        label: string
        onClick: () => void
    }
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
    return (
        <Card>
            <CardContent className="py-16 text-center">
                <div className="flex justify-center mb-4">
                    {icon || <Inbox className="w-16 h-16 text-gray-300" />}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
                <p className="text-gray-600 mb-6 max-w-md mx-auto">{description}</p>
                {action && (
                    <Button variant="primary" onClick={action.onClick}>
                        {action.label}
                    </Button>
                )}
            </CardContent>
        </Card>
    )
}

export function NoFilesState({ onUpload }: { onUpload: () => void }) {
    return (
        <EmptyState
            icon={<FileX className="w-16 h-16 text-gray-300" />}
            title="No files found"
            description="Upload your first file to get started with managing your website content."
            action={{ label: 'Upload File', onClick: onUpload }}
        />
    )
}

export function NoDatabasesState({ onCreate }: { onCreate: () => void }) {
    return (
        <EmptyState
            icon={<Database className="w-16 h-16 text-gray-300" />}
            title="No databases yet"
            description="Create your first MySQL database to start storing your application data."
            action={{ label: 'Create Database', onClick: onCreate }}
        />
    )
}

export function NoDeploymentsState({ onDeploy }: { onDeploy: () => void }) {
    return (
        <EmptyState
            icon={<FolderOpen className="w-16 h-16 text-gray-300" />}
            title="No deployments yet"
            description="Connect your Git repository and deploy your first application."
            action={{ label: 'Deploy Now', onClick: onDeploy }}
        />
    )
}
