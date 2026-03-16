export type Role = 'owner' | 'editor' | 'viewer' | 'user'

export type Permission =
    | 'manage_billing'
    | 'delete_service'
    | 'manage_websites'
    | 'manage_files'
    | 'manage_databases'
    | 'view_analytics'
    | 'view_logs'
    | 'manage_team'
    | 'manage_dns'
    | 'manage_email'

export interface User {
    id: string
    email: string
    name: string
    role: Role
    project_quota?: number
    platform_role?: 'super_admin' | 'user'
    avatar?: string
    emailVerified: boolean
    mfaEnabled: boolean
    createdAt: string
    lastLoginAt?: string
    lastLoginLocation?: string
}

export interface LoginCredentials {
    email: string
    password: string
    rememberMe?: boolean
}

export interface RegisterData {
    name: string
    email: string
    password: string
    confirmPassword: string
    acceptTerms: boolean
}

export interface ResetPasswordData {
    token: string
    password: string
    confirmPassword: string
}

export interface ForgotPasswordData {
    email: string
}

export interface MFASetup {
    secret: string
    qrCode: string
    backupCodes: string[]
}

export interface MFAVerification {
    code: string
    trustDevice?: boolean
}

export interface AuthState {
    user: User | null
    token: string | null
    isAuthenticated: boolean
    isLoading: boolean
    error: string | null
    login: (credentials: LoginCredentials) => Promise<void>
    register: (data: RegisterData) => Promise<void>
    logout: () => void
    logoutEverywhere: () => Promise<void>
    refreshToken: () => Promise<void>
    updateUser: (user: Partial<User>) => void
    clearError: () => void
    /** Clear local session state without calling the backend logout endpoint.
     *  Use this when the server already rejected the token (401) so there is
     *  no point (or it would fail) trying to invalidate it server-side. */
    clearSession: () => void
}

export interface Session {
    id: string
    deviceName: string
    browser: string
    os: string
    location: string
    ipAddress: string
    lastActive: string
    isCurrent: boolean
}

export interface AuditLog {
    id: string
    event: 'login' | 'logout' | 'password_change' | 'mfa_setup' | 'mfa_disable' | 'profile_update'
    description: string
    ipAddress: string
    location: string
    deviceInfo: string
    timestamp: string
}
