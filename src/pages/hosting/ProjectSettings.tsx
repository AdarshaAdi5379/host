
import { useParams } from 'react-router-dom'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TeamManagement } from '@/components/team/TeamManagement'
import { AuditLogViewer } from '@/components/audit/AuditLogViewer'
import { Card } from '@/components/ui/card'

export function ProjectSettings() {
    const { id } = useParams<{ id: string }>()

    if (!id) return null

    return (
        <div className="space-y-6">
            <Breadcrumbs
                items={[
                    { label: 'Hosting', href: '/hosting' },
                    { label: 'Project Settings' }
                ]}
            />

            <div>
                <h1 className="text-3xl font-bold text-brand-navy">Project Settings</h1>
                <p className="text-gray-600 mt-1">Manage configuration and team access</p>
            </div>

            <Tabs defaultValue="team" className="w-full">
                <TabsList className="mb-4">
                    <TabsTrigger value="general">General</TabsTrigger>
                    <TabsTrigger value="team">Team Members</TabsTrigger>
                    <TabsTrigger value="logs">Audit Logs</TabsTrigger>
                </TabsList>

                <TabsContent value="general">
                    <Card className="p-6">
                        <h3 className="text-lg font-semibold mb-4">General Configuration</h3>
                        <p className="text-gray-500">
                            General settings like site name rename or transfer ownership will go here.
                        </p>
                    </Card>
                </TabsContent>

                <TabsContent value="team">
                    <TeamManagement projectId={id} />
                </TabsContent>

                <TabsContent value="logs">
                    <AuditLogViewer projectId={id} />
                </TabsContent>
            </Tabs>
        </div>
    )
}
