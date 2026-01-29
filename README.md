<div align="center">
  <h1>🚀 hPanel Frontend Clone</h1>
  <p><strong>Professional-Grade Deployment & Hosting Management Platform</strong></p>
  
  <p>
    <img src="https://img.shields.io/badge/React-19-blue.svg" alt="React 19">
    <img src="https://img.shields.io/badge/Vite-6.0-purple.svg" alt="Vite">
    <img src="https://img.shields.io/badge/Tailwind-4.0-38b2ac.svg" alt="Tailwind">
    <img src="https://img.shields.io/badge/TypeScript-Ready-blue.svg" alt="TypeScript">
  </p>
</div>

<hr />

<h2>📖 Overview</h2>
<p>
  This project is a high-fidelity <b>Single Page Application (SPA)</b> built with <b>React</b>. It replicates the sophisticated user experience of the Hostinger "hPanel," focusing on modularity, security, and developer productivity. It is designed to handle complex server management tasks through an intuitive, mobile-responsive interface.
</p>



<hr />

<h2>🛠️ Tech Stack</h2>
<table width="100%">
  <tr>
    <th align="left">Category</th>
    <th align="left">Technology</th>
    <th align="left">Purpose</th>
  </tr>
  <tr>
    <td><b>Core</b></td>
    <td>React 19 + Vite</td>
    <td>Fast HMR and component-based rendering.</td>
  </tr>
  <tr>
    <td><b>Styling</b></td>
    <td>Tailwind CSS + Shadcn/UI</td>
    <td>Accessible, utility-first design system.</td>
  </tr>
  <tr>
    <td><b>State</b></td>
    <td>Zustand + TanStack Query</td>
    <td>Global UI state and server data caching.</td>
  </tr>
  <tr>
    <td><b>Routing</b></td>
    <td>React Router 7</td>
    <td>Deep-nested dashboard navigation.</td>
  </tr>
  <tr>
    <td><b>Validation</b></td>
    <td>Zod + React Hook Form</td>
    <td>Strict type-safe form management.</td>
  </tr>
</table>

<hr />

<h2>📂 Key Features</h2>
<ul>
  <li><b>Unified Dashboard:</b> Overview of hosting, domains, and resource consumption.</li>
  <li><b>Deployment Engine:</b> CI/CD pipeline with Git integration, real-time streaming build logs, and direct drag-and-drop uploads.</li>
  <li><b>DNS Manager:</b> Advanced table interface for managing complex DNS records (A, MX, CNAME).</li>
  <li><b>File Explorer:</b> Browser-based directory management with upload/edit capabilities.</li>
  <li><b>Identity Suite:</b> Secure RBAC (Role-Based Access Control) with MFA support.</li>
  <li><b>Billing Center:</b> Automated subscription tracking and PDF invoice generation.</li>
</ul>



<hr />

<h2>🏗️ Project Structure</h2>

<details>
<summary><b>📁 Click to expand detailed project structure</b></summary>

<h3>📂 Root Directory</h3>
<pre>
host/
├── 📄 package.json          # Dependencies and scripts
├── 📄 vite.config.ts         # Vite build configuration
├── 📄 tailwind.config.js     # Tailwind CSS customization
├── 📄 tsconfig.json          # TypeScript compiler options
└── 📁 src/                   # Source code directory
</pre>

<hr />

<h3>📂 Source Directory (<code>src/</code>)</h3>

<h4>🎨 <code>components/</code> - Reusable UI Components</h4>
<table width="100%">
  <tr>
    <th align="left">Folder</th>
    <th align="left">Purpose</th>
    <th align="left">Examples</th>
  </tr>
  <tr>
    <td><code>ui/</code></td>
    <td>Shadcn/UI base components</td>
    <td>Button, Input, Card, Badge, Toast</td>
  </tr>
  <tr>
    <td><code>layout/</code></td>
    <td>App shell and navigation</td>
    <td>Navbar, Sidebar, AppLayout</td>
  </tr>
  <tr>
    <td><code>auth/</code></td>
    <td>Authentication components</td>
    <td>ProtectedRoute, AuthLayout</td>
  </tr>
  <tr>
    <td><code>dashboard/</code></td>
    <td>Dashboard-specific widgets</td>
    <td>StatsCard, QuickActions, ResourceUsage</td>
  </tr>
  <tr>
    <td><code>domains/</code></td>
    <td>Domain management components</td>
    <td>DomainCart, EPPCodeInput, PrivacyProtectionModal</td>
  </tr>
  <tr>
    <td><code>settings/</code></td>
    <td>Settings page components</td>
    <td>AvatarUpload, FloatingSaveBar</td>
  </tr>
  <tr>
    <td><code>deployment/</code></td>
    <td>Deployment workflow components</td>
    <td>FileUploader, CodeEditor, DeploymentLogs</td>
  </tr>
</table>

<h4>📄 <code>pages/</code> - Route Components</h4>
<pre>
pages/
├── 📁 auth/                  # Authentication pages
│   ├── Login.tsx
│   ├── Signup.tsx
│   ├── ForgotPassword.tsx
│   └── ResetPassword.tsx
├── 📁 domains/               # Domain management
│   ├── DomainSearch.tsx
│   └── DomainTransferWizard.tsx
├── 📁 settings/              # User settings
│   ├── SettingsLayout.tsx
│   ├── GeneralSettings.tsx
│   ├── SecuritySettings.tsx
│   ├── NotificationSettings.tsx
│   └── SessionManagement.tsx
├── 📁 hosting/               # Hosting management
│   ├── DNSEditor.tsx
│   ├── DatabaseManager.tsx
│   └── FileManager.tsx
├── 📁 deployment/            # Deployment workflows
│   ├── GitDeployment.tsx
│   └── FileManager.tsx
├── 📁 apps/                  # App installer
│   └── AppInstaller.tsx
├── Dashboard.tsx             # Main dashboard
├── HostingManagement.tsx     # Hosting overview
├── DomainManagement.tsx      # Domain list
├── EmailManagement.tsx       # Email accounts
├── BillingManagement.tsx     # Billing & invoices
└── Analytics.tsx             # Analytics dashboard
</pre>

<h4>🗃️ <code>store/</code> - State Management (Zustand)</h4>
<table width="100%">
  <tr>
    <th align="left">Store</th>
    <th align="left">Purpose</th>
  </tr>
  <tr>
    <td><code>authStore.ts</code></td>
    <td>User authentication state, login/logout, session management</td>
  </tr>
  <tr>
    <td><code>domainStore.ts</code></td>
    <td>Domain cart, selected domains, checkout state</td>
  </tr>
  <tr>
    <td><code>deploymentStore.ts</code></td>
    <td>Git connections, build settings, deployment history</td>
  </tr>
  <tr>
    <td><code>settingsStore.ts</code></td>
    <td>User preferences, notification settings, localization</td>
  </tr>
  <tr>
    <td><code>toastStore.ts</code></td>
    <td>Toast notification queue and management</td>
  </tr>
  <tr>
    <td><code>themeStore.ts</code></td>
    <td>Theme preferences (light/dark mode)</td>
  </tr>
</table>

<h4>🔧 <code>lib/</code> - Utility Functions & Helpers</h4>
<table width="100%">
  <tr>
    <th align="left">File</th>
    <th align="left">Purpose</th>
  </tr>
  <tr>
    <td><code>utils.ts</code></td>
    <td>General utility functions (cn, formatters)</td>
  </tr>
  <tr>
    <td><code>domainUtils.ts</code></td>
    <td>Domain validation, TLD extraction, EPP code validation</td>
  </tr>
  <tr>
    <td><code>deploymentUtils.ts</code></td>
    <td>Build command validation, log parsing, status colors</td>
  </tr>
  <tr>
    <td><code>identicon.ts</code></td>
    <td>Generate fallback avatars with initials</td>
  </tr>
  <tr>
    <td><code>settingsValidation.ts</code></td>
    <td>Zod schemas for settings forms</td>
  </tr>
  <tr>
    <td><code>authValidation.ts</code></td>
    <td>Zod schemas for authentication forms</td>
  </tr>
  <tr>
    <td><code>mockData.ts</code></td>
    <td>Mock data for development and testing</td>
  </tr>
</table>

<h4>📝 <code>types/</code> - TypeScript Type Definitions</h4>
<pre>
types/
├── auth.ts                   # User, Role, Permission, Session types
├── domain.ts                 # Domain, Transfer, Cart, Suggestion types
└── deployment.ts             # Repository, Build, Deployment types
</pre>

<h4>🪝 <code>hooks/</code> - Custom React Hooks</h4>
<table width="100%">
  <tr>
    <th align="left">Hook</th>
    <th align="left">Purpose</th>
  </tr>
  <tr>
    <td><code>useDomainSearch.ts</code></td>
    <td>Debounced domain search with TanStack Query caching</td>
  </tr>
  <tr>
    <td><code>usePermissions.ts</code></td>
    <td>Check user permissions for RBAC</td>
  </tr>
</table>

<h4>📊 <code>data/</code> - Static Data & Constants</h4>
<pre>
data/
└── mockData.ts               # Mock API responses for development
</pre>

</details>

<hr />

<h3>🎯 Architecture Highlights</h3>

<table width="100%">
  <tr>
    <th align="left">Pattern</th>
    <th align="left">Implementation</th>
  </tr>
  <tr>
    <td><b>Component Organization</b></td>
    <td>Atomic design - UI atoms → Feature components → Pages</td>
  </tr>
  <tr>
    <td><b>State Management</b></td>
    <td>Zustand for global state + TanStack Query for server state</td>
  </tr>
  <tr>
    <td><b>Type Safety</b></td>
    <td>Strict TypeScript with Zod runtime validation</td>
  </tr>
  <tr>
    <td><b>Code Splitting</b></td>
    <td>Route-based lazy loading with React.lazy()</td>
  </tr>
  <tr>
    <td><b>Authentication</b></td>
    <td>Protected routes with RBAC (Role-Based Access Control)</td>
  </tr>
  <tr>
    <td><b>Styling</b></td>
    <td>Tailwind CSS with custom design tokens + Shadcn/UI components</td>
  </tr>
</table>

<hr />

<h2>🚦 Getting Started</h2>

<h3>1. Installation</h3>
<p>Clone the repository and install dependencies:</p>
<code>git clone https://github.com/your-username/hpanel-clone.git</code><br/>
<code>npm install</code>

<h3>2. Development</h3>
<p>Launch the Vite development server:</p>
<code>npm run dev</code>

<hr />

<div align="center">
  <p>Created for Computer Science Portfolio - 2026</p>
</div>