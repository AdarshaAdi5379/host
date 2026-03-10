
import { useEffect, useState } from 'react'
import { Globe, ArrowRight, Shield } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Link } from 'react-router-dom'
import { useAuthStore, useHasHydrated } from '@/store/authStore'
import { API_BASE_URL } from '@/lib/api/config'

interface ProjectMembership {
    id: number
    project: number
    project_name: string
    role: 'owner' | 'collaborator'
    joined_at: string
}

export function CollaboratorDashboard() {
    const { token, isAuthenticated } = useAuthStore()
    const hydrated = useHasHydrated()
    const [memberships, setMemberships] = useState<ProjectMembership[]>([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        if (!hydrated) return
        if (!isAuthenticated || !token) {
            setIsLoading(false)
            return
        }
        const fetchMemberships = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/api/team/`, {
                    headers: { 'Authorization': `Token ${token}` }
                })
                if (response.ok) {
                    const data = await response.json()
                    setMemberships(data)
                }
            } catch (error) {
                console.error('Failed to fetch memberships:', error)
            } finally {
                setIsLoading(false)
            }
        }
        fetchMemberships()
    }, [hydrated, isAuthenticated, token])

    if (isLoading) {
        return <div className="p-8 text-center text-gray-500">Loading shared projects...</div>
    }

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
                    Shared with Me
                </h1>
                <p className="text-gray-500">Projects you are collaborating on</p>
            </div>

            {memberships.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {memberships.map(membership => (
                        <Card key={membership.id} className="p-6 hover:shadow-lg transition-all border-gray-200">
                            <div className="flex justify-between items-start mb-4">
                                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                                    <Globe className="w-5 h-5 text-blue-600" />
                                </div>
                                <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100">
                                    {membership.role}
                                </Badge>
                            </div>

                            <h3 className="text-lg font-semibold mb-1">{membership.project_name}</h3>
                            <p className="text-sm text-gray-500 mb-6">
                                Joined on {new Date(membership.joined_at).toLocaleDateString()}
                            </p>

                            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                                <span className="text-xs text-gray-400 flex items-center">
                                    <Shield className="w-3 h-3 mr-1" />
                                    Limited Access
                                </span>
                                <Link to={`/hosting/${membership.project}/settings`}>
                                    <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 p-0 h-auto font-medium">
                                        View Project <ArrowRight className="w-4 h-4 ml-1" />
                                    </Button>
                                </Link>
                            </div>
                        </Card>
                    ))}
                </div>
            ) : (
                <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                        <Users className="w-6 h-6 text-blue-500" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">No shared projects</h3>
                    <p className="text-gray-500">You haven't been invited to any projects yet.</p>
                </div>
            )}
        </div>
    )
}

function Users(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
    )
}
