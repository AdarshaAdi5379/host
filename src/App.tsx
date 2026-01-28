import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
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
          <Route path="hosting" element={<HostingManagement />} />
          <Route path="hosting/dns" element={<DNSEditor />} />
          <Route path="hosting/databases" element={<DatabaseManager />} />
          <Route path="hosting/files" element={<FileManager />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="deployment/git" element={<GitDeployment />} />
          <Route path="apps" element={<AppInstaller />} />
          <Route path="domains" element={<DomainManagement />} />
          <Route path="emails" element={<EmailManagement />} />
          <Route path="billing" element={<BillingPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
