import { useState, useEffect } from 'react'
import { UserPlus, Trash2, Mail } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/store/authStore'
import { useToast } from '@/components/ui/toast'
import { teamAPI, type TeamMember } from '@/lib/api/team'

export function TeamManagement({ projectId }: { projectId: string }) {
    const { token } = useAuthStore()
    const { addToast } = useToast()
    const [members, setMembers] = useState<TeamMember[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [inviteEmail, setInviteEmail] = useState('')
    const [inviteRole, setInviteRole] = useState<'collaborator' | 'owner'>('collaborator')
    const [isInviting, setIsInviting] = useState(false)

    useEffect(() => {
        if (projectId) {
            fetchMembers()
        }
    }, [projectId])

    const fetchMembers = async () => {
        setIsLoading(true)
        try {
            const data = await teamAPI.getMembers(projectId, token!)
            setMembers(data)
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to load team members'
            addToast({ title: 'Error', description: message, variant: 'error' })
        } finally {
            setIsLoading(false)
        }
    }

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsInviting(true)

        try {
            await teamAPI.inviteMember(projectId, inviteEmail, inviteRole, token!)
            setInviteEmail('')
            addToast({
                title: 'Member Invited',
                description: `${inviteEmail} has been added as ${inviteRole}.`,
                variant: 'success',
            })
            fetchMembers()
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to invite member'
            addToast({ title: 'Invite Failed', description: message, variant: 'error' })
        } finally {
            setIsInviting(false)
        }
    }

    const handleRemoveMember = async (userId: number, userEmail: string) => {
        if (!confirm(`Remove ${userEmail} from this project?`)) return

        try {
            await teamAPI.removeMember(projectId, userId, token!)
            addToast({
                title: 'Member Removed',
                description: `${userEmail} has been removed from the project.`,
                variant: 'success',
            })
            setMembers((prev) => prev.filter((m) => m.user.id !== userId))
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to remove member'
            addToast({ title: 'Error', description: message, variant: 'error' })
        }
    }

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold">Team Members</h2>
                    <p className="text-gray-500">Manage access to this project</p>
                </div>
            </div>

            {/* Invite Form */}
            <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Invite New Member</h3>
                <form onSubmit={handleInvite} className="flex gap-4 items-end">
                    <div className="flex-1 space-y-2">
                        <label className="text-sm font-medium text-gray-700">Email Address</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input
                                type="email"
                                placeholder="colleague@example.com"
                                className="pl-10"
                                value={inviteEmail}
                                onChange={(e) => setInviteEmail(e.target.value)}
                                required
                            />
                        </div>
                    </div>
                    <div className="w-48 space-y-2">
                        <label className="text-sm font-medium text-gray-700">Role</label>
                        <Select value={inviteRole} onValueChange={(v: any) => setInviteRole(v)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="collaborator">Collaborator</SelectItem>
                                <SelectItem value="owner">Co-Owner</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <Button type="submit" disabled={isInviting}>
                        {isInviting ? 'Inviting...' : 'Invite Member'}
                        <UserPlus className="w-4 h-4 ml-2" />
                    </Button>
                </form>
                <p className="text-xs text-gray-500 mt-2">
                    Note: The user must already be registered on the platform.
                </p>
            </Card>

            {/* Members List */}
            {isLoading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
                    ))}
                </div>
            ) : members.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                    <p className="font-medium">No team members yet</p>
                    <p className="text-sm mt-1">Invite a colleague to collaborate on this project.</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {members.map((member) => (
                        <Card key={member.id} className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-brand-purple/10 flex items-center justify-center text-brand-purple font-semibold">
                                    {(member.user.first_name?.[0] || member.user.username[0]).toUpperCase()}
                                </div>
                                <div>
                                    <h4 className="font-medium">
                                        {member.user.first_name || member.user.last_name
                                            ? `${member.user.first_name} ${member.user.last_name}`.trim()
                                            : member.user.username}
                                    </h4>
                                    <p className="text-sm text-gray-500">{member.user.email}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <Badge variant={member.role === 'owner' ? 'default' : 'secondary'}>
                                    {member.role === 'owner' ? 'Owner' : 'Collaborator'}
                                </Badge>

                                <span className="text-xs text-gray-400">
                                    Joined {new Date(member.joined_at).toLocaleDateString()}
                                </span>

                                {member.role !== 'owner' && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                        onClick={() => handleRemoveMember(member.user.id, member.user.email)}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                )}
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
