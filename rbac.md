# Role-Based Access Control (RBAC) System

The HOST platform implements a robust 3-Tier Hierarchy for access management, ensuring secure and flexible collaboration.

## 1. Roles Overview

### 👑 Super Admin
*   **Scope:** Entire Platform
*   **Description:** Has unrestricted access to all projects, users, and system configurations.
*   **Key Capabilities:**
    *   View, edit, and delete ANY project (regardless of ownership).
    *   Manage all users and teams.
    *   Access system-wide audit logs.
    *   Bypass all permission checks.

### 👤 Site Owner (Project Creator)
*   **Scope:** Owned Projects Only
*   **Description:** The user who created the project. Has full control over the project lifecycle.
*   **Key Capabilities:**
    *   **Exclusive:** Only the Site Owner (or Super Admin) can **DELETE** the project.
    *   Manage billing and subscription for the project.
    *   Transfer ownership (if feature enabled).

### 🤝 Team Members

Team members are invited to specific projects and can have one of two roles:

#### A. Owner (Co-Owner)
*   **Scope:** Assigned Project Only
*   **Description:** A trusted partner with administrative privileges on the project.
*   **Key Capabilities:**
    *   **Manage Team:** Can invite new members or remove existing ones.
    *   **Environment:** Can add/edit/delete Environment Variables.
    *   **Settings:** Can change domain settings and other critical configurations.
    *   **Operations:** Start/Stop/Restart containers, access terminal/logs/db.
    *   **Limitation:** Cannot delete the project.

#### B. Collaborator
*   **Scope:** Assigned Project Only
*   **Description:** A developer or contributor working on the project content/code.
*   **Key Capabilities:**
    *   **Operations:** Start/Stop/Restart containers.
    *   **Access:** Full access to Files, Database, Terminal, and Logs.
    *   **View Only:** Can view Environment Variables and Settings but **cannot edit** them.
    *   **Limitation:** Cannot manage team, cannot edit env vars, cannot delete project.

---

## 2. Feature Matrix

| Feature | Super Admin | Site Owner | Co-Owner | Collaborator |
| :--- | :---: | :---: | :---: | :---: |
| **Create Projects** | ✅ | ✅ | ❌ | ❌ |
| **Delete Project** | ✅ | ✅ | ❌ | ❌ |
| **Manage Team (Invite/Remove)** | ✅ | ✅ | ✅ | ❌ |
| **Edit Environment Vars** | ✅ | ✅ | ✅ | ❌ (View Only) |
| **Manage Domains** | ✅ | ✅ | ✅ | ❌ (View Only) |
| **Start/Stop Containers** | ✅ | ✅ | ✅ | ✅ |
| **Access Terminal / Logs** | ✅ | ✅ | ✅ | ✅ |
| **Access Database / Files** | ✅ | ✅ | ✅ | ✅ |
| **View Audit Logs** | ✅ (All) | ✅ (Project) | ✅ (Project) | ✅ (Project) |

---

## 3. Management Commands (CLI)

While most role management is done via the **Dashboard UI**, you can manage Super Admins via the command line.

### Create a Super Admin
```bash
# In the backend directory
python manage.py createsuperuser
```

### Manually Assign Roles (via Django Shell)
If you need to manually fix permissions or roles for debugging:

```bash
python manage.py shell
```

```python
from django.contrib.auth.models import User
from sites.models import ProjectMembership, WordPressSite, UserProfile

# 1. Promote a user to Super Admin
user = User.objects.get(email='user@example.com')
profile = user.profile
profile.platform_role = 'super_admin'
profile.save()

# 2. Check a user's role in a project
project = WordPressSite.objects.get(name='My Project')
member = ProjectMembership.objects.get(project=project, user=user)
print(member.role)  # 'owner' or 'collaborator'

# 3. Change a member's role manually
member.role = 'owner'
member.save()
```

## 4. API Endpoints

*   **Invite Member:** `POST /api/team/{project_id}/invite/`
    *   Body: `{"email": "user@example.com", "role": "collaborator"}`
*   **List Team:** `GET /api/team/{project_id}/`
*   **Remove Member:** `DELETE /api/team/{project_id}/{user_id}/`
