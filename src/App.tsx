import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { Dashboard } from '@/pages/Dashboard'
import { useAuthStore } from '@/store/authStore'

// Placeholder pages for routing
function HostingPage() {
  return <div className="text-2xl font-bold">Hosting Page - Coming Soon</div>
}

function DomainsPage() {
  return <div className="text-2xl font-bold">Domains Page - Coming Soon</div>
}

function EmailsPage() {
  return <div className="text-2xl font-bold">Emails Page - Coming Soon</div>
}

function BillingPage() {
  return <div className="text-2xl font-bold">Billing Page - Coming Soon</div>
}

function App() {
  const isAuthenticated = useAuthStore(state => state.isAuthenticated)

  // For now, we're always authenticated in development
  // In production, you'd add proper auth routes here

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="hosting" element={<HostingPage />} />
          <Route path="domains" element={<DomainsPage />} />
          <Route path="emails" element={<EmailsPage />} />
          <Route path="billing" element={<BillingPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
