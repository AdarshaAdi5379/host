## 🔐 Test Accounts

We've created dummy accounts for testing different user experiences:

### 👑 Admin Account (Full Access)
```
Email: demo@example.com
Password: DemoPass123!
Role: Owner/Admin
```
**Features:**
- Full administrative access
- Manage billing and subscriptions
- Team management
- All service controls
- Analytics and logs access

---

### 👤 Regular User Account (Limited Access)
```
Email: user@example.com
Password: UserPass123!
Role: User
```
**Features:**
- View-only dashboard
- Basic file management
- Limited DNS access
- No billing access
- No team management
- Personal settings only

---

### 🌐 Google OAuth Configuration

To configure Google Login, update your Google Cloud Console with these URIs:

**Authorized JavaScript origins:**
```
http://localhost:5173
```

**Authorized redirect URIs:**
```
http://localhost:5173/auth/google/callback
```

---

### 🗄️ Database Administration (Adminer)

Access your WordPress databases via the secure Adminer interface.

**URL:** `https://db.edubricz.online`

**Access Instructions:**
1. Login to the Dashboard.
2. Go to **Quick Actions** > **Databases**.
3. Select a site to view its specific credentials.
4. Copy the **Server**, **Username**, and **Password**.
5. Open `https://db.edubricz.online` and paste the credentials.

**System:** MySQL

---

### 📁 File Manager (FileBrowser)

Access and manage your WordPress site files directly through the browser.

**URL:** `https://files.edubricz.online`

**Default Login Credentials:**
```
Username: admin
Password: b3qzDb-CsDu_fz8k
```

**⚠️ IMPORTANT:** Change this password immediately after first login!

**Access Instructions:**
1. Add DNS CNAME record in Cloudflare:
   - Name: `files`
   - Target: `f7a24d5d-ea18-477f-bd26-6dfc0f3b2774.cfargotunnel.com`
   - Proxy: Enabled (orange cloud)
2. Visit `https://files.edubricz.online`
3. Login with credentials above
4. Navigate to `/srv/{site_name}/` to access site files
5. **Change password**: Settings → User Management → Edit admin user

**Common Tasks:**
- Upload themes/plugins to `wp-content/themes/` or `wp-content/plugins/`
- Edit `wp-config.php` for configuration changes
- Disable broken plugins by renaming their folders
- Download backups of your files

**Security Notes:**
- Delete operations are disabled by default
- Upload limit: 100MB per file
- Access is restricted via Cloudflare Tunnel (no direct exposure)
