import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { Dashboard } from '@/pages/Dashboard'
import { DNSEditor } from '@/pages/hosting/DNSEditor'
import { DatabaseManager } from '@/pages/hosting/DatabaseManager'
import { FileManager } from '@/pages/hosting/FileManager'
import { Analytics } from '@/pages/Analytics'
import { GitDeployment } from '@/pages/deployment/GitDeployment'
import { AppInstaller } from '@/pages/apps/AppInstaller'

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
  // For now, we're always authenticated in development
  // In production, you'd add proper auth routes here

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="hosting" element={<HostingPage />} />
          <Route path="hosting/dns" element={<DNSEditor />} />
          <Route path="hosting/databases" element={<DatabaseManager />} />
          <Route path="hosting/files" element={<FileManager />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="deployment/git" element={<GitDeployment />} />
          <Route path="apps" element={<AppInstaller />} />
          <Route path="domains" element={<DomainsPage />} />
          <Route path="emails" element={<EmailsPage />} />
          <Route path="billing" element={<BillingPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
