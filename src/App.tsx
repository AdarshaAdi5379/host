import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { Dashboard } from '@/pages/Dashboard'
import { DNSEditor } from '@/pages/hosting/DNSEditor'
import { DatabaseManager } from '@/pages/hosting/DatabaseManager'
import { FileManager } from '@/pages/hosting/FileManager'
import { Analytics } from '@/pages/Analytics'
import { GitDeployment } from '@/pages/deployment/GitDeployment'
import { AppInstaller } from '@/pages/apps/AppInstaller'
import { HostingManagement } from '@/pages/HostingManagement'
import { DomainManagement } from '@/pages/DomainManagement'
import { EmailManagement } from '@/pages/EmailManagement'
import { BillingManagement } from '@/pages/BillingManagement'
import { Login } from '@/pages/auth/Login'
import { Signup } from '@/pages/auth/Signup'
import { ForgotPassword } from '@/pages/auth/ForgotPassword'
import { ResetPassword } from '@/pages/auth/ResetPassword'
import { useAuthStore } from '@/store/authStore'

function App() {
  const { isAuthenticated } = useAuthStore()

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Auth Routes */}
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />}
        />
        <Route
          path="/signup"
          element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Signup />}
        />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />

        {/* Protected Dashboard Routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="hosting" element={<HostingManagement />} />
          <Route path="hosting/dns" element={<DNSEditor />} />
          <Route path="hosting/databases" element={<DatabaseManager />} />
          <Route path="hosting/files" element={<FileManager />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="deployment/git" element={<GitDeployment />} />
          <Route path="apps" element={<AppInstaller />} />
          <Route path="domains" element={<DomainManagement />} />
          <Route path="emails" element={<EmailManagement />} />
          <Route
            path="billing"
            element={
              <ProtectedRoute requiredPermission="manage_billing">
                <BillingManagement />
              </ProtectedRoute>
            }
          />
        </Route>

        {/* Catch all - redirect to login or dashboard */}
        <Route
          path="*"
          element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />}
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App
