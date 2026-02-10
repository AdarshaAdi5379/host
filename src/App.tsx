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
import { EmailManagement } from '@/pages/EmailManagement'
import { BillingManagement } from '@/pages/BillingManagement'
import { Login } from '@/pages/auth/Login'
import { Signup } from '@/pages/auth/Signup'
import { ForgotPassword } from '@/pages/auth/ForgotPassword'
import { ResetPassword } from '@/pages/auth/ResetPassword'
import { GoogleCallback } from '@/pages/auth/GoogleCallback'
import { SettingsLayout } from '@/pages/settings/SettingsLayout'
import { GeneralSettings } from '@/pages/settings/GeneralSettings'
import { SecuritySettings } from '@/pages/settings/SecuritySettings'
import { NotificationSettings } from '@/pages/settings/NotificationSettings'
import { SessionManagement } from '@/pages/settings/SessionManagement'
import { useAuthStore } from '@/store/authStore'
import { CreateHosting } from '@/pages/hosting/CreateHosting'
import { DomainSearch } from '@/pages/domains/DomainSearch'
import { CreateEmail } from '@/pages/email/CreateEmail'
import { DomainTransferWizard } from '@/pages/domains/DomainTransferWizard'
import DomainManagement from '@/pages/settings/DomainManagement'
import DomainsOverview from '@/pages/DomainsOverview'

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
        <Route path="/auth/google/callback" element={<GoogleCallback />} />

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
          <Route path="hosting/create" element={<CreateHosting />} />
          <Route path="hosting/dns" element={<DNSEditor />} />
          <Route path="hosting/databases" element={<DatabaseManager />} />
          <Route path="hosting/files" element={<FileManager />} />
          <Route path="sites/:id/domains" element={<DomainManagement />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="deployment/git" element={<GitDeployment />} />
          <Route path="apps" element={<AppInstaller />} />
          <Route path="domains" element={<DomainsOverview />} />
          <Route path="domains/search" element={<DomainSearch />} />
          <Route path="domains/transfer" element={<DomainTransferWizard />} />
          <Route path="email" element={<EmailManagement />} />
          <Route path="email/create" element={<CreateEmail />} />
          <Route
            path="billing"
            element={
              <ProtectedRoute requiredPermission="manage_billing">
                <BillingManagement />
              </ProtectedRoute>
            }
          />

          {/* Settings Routes */}
          <Route path="settings" element={<SettingsLayout />}>
            <Route index element={<Navigate to="/settings/general" replace />} />
            <Route path="general" element={<GeneralSettings />} />
            <Route path="security" element={<SecuritySettings />} />
            <Route path="notifications" element={<NotificationSettings />} />
            <Route path="sessions" element={<SessionManagement />} />
          </Route>
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
