import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { authAPI } from '@/lib/api/auth'
import { Loader2 } from 'lucide-react'

export function GoogleCallback() {
    const navigate = useNavigate()
    const { user, token, isAuthenticated } = useAuthStore()

    useEffect(() => {
        const handleGoogleCallback = async () => {
            const params = new URLSearchParams(window.location.search)
            const code = params.get('code')
            const error = params.get('error')

            if (error) {
                console.error('Google OAuth error:', error)
                navigate('/login?error=google_auth_failed')
                return
            }

            if (!code) {
                navigate('/login')
                return
            }

            try {
                // Exchange code for token
                const response = await authAPI.googleLogin(code)

                // Fetch user profile
                const userProfile = await authAPI.getUser(response.key)

                // Update auth store
                useAuthStore.setState({
                    user: userProfile,
                    token: response.key,
                    isAuthenticated: true,
                    isLoading: false,
                    error: null,
                })

                // Redirect to dashboard
                navigate('/dashboard')
            } catch (err) {
                console.error('Google login error:', err)
                navigate('/login?error=google_auth_failed')
            }
        }

        // Only process if not already authenticated
        if (!isAuthenticated) {
            handleGoogleCallback()
        } else {
            navigate('/dashboard')
        }
    }, [navigate, isAuthenticated])

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
                <p className="text-gray-600">Processing Google login...</p>
            </div>
        </div>
    )
}
