import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { authAPI } from '@/lib/api/auth'
import { Loader2 } from 'lucide-react'

export function GoogleCallback() {
    const navigate = useNavigate()
    const calledRef = useRef(false)

    useEffect(() => {
        // Guard against React StrictMode double-invocation — the OAuth tokens
        // in the hash are single-use and must only be submitted to the backend once.
        if (calledRef.current) return
        calledRef.current = true

        const { isAuthenticated } = useAuthStore.getState()
        if (isAuthenticated) {
            navigate('/dashboard', { replace: true })
            return
        }

        const handleGoogleCallback = async () => {
            // With response_type=token id_token, Google places the tokens in the
            // URL hash fragment: #access_token=...&id_token=...&token_type=Bearer
            const hash = window.location.hash.slice(1)
            const params = new URLSearchParams(hash)

            const accessToken = params.get('access_token')
            const idToken = params.get('id_token')
            const error = params.get('error')

            if (error) {
                console.error('Google OAuth error:', error)
                navigate('/login?error=google_auth_failed', { replace: true })
                return
            }

            if (!accessToken || !idToken) {
                // Fallback: check the query string for an error param
                const queryError = new URLSearchParams(window.location.search).get('error')
                if (queryError) {
                    console.error('Google OAuth error:', queryError)
                }
                console.error('Google OAuth: missing access_token or id_token in callback URL hash')
                navigate('/login?error=google_auth_failed', { replace: true })
                return
            }

            try {
                const response = await authAPI.googleLogin(accessToken, idToken)
                // Use me() to get the full user profile (same as email/password login)
                // getUser() returns a raw Django auth shape without role/name.
                const userProfile = await authAPI.me(response.key)

                useAuthStore.setState({
                    user: userProfile,
                    token: response.key,
                    isAuthenticated: true,
                    isLoading: false,
                    error: null,
                })

                navigate('/dashboard', { replace: true })
            } catch (err) {
                console.error('Google login error:', err)
                navigate('/login?error=google_auth_failed', { replace: true })
            }
        }

        void handleGoogleCallback()
    }, [navigate]) // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
                <p className="text-gray-600">Processing Google login...</p>
            </div>
        </div>
    )
}
