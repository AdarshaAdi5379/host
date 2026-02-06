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
