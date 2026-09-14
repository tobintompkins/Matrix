# Service Hub

The Matrix dashboard is now presented to users as the **Service Hub**.

## Routes

| Route | Behavior |
|-------|----------|
| `/dashboard` | Canonical Service Hub page (preserved) |
| `/service-hub` | Redirect alias → `/dashboard` |

Internal identifiers (`DashboardPage`, `DashboardOpsPanel`, `/api/pm/dashboard`, etc.) remain unchanged to avoid breaking the application.

## What users see

- Navigation label: **Service Hub**
- Shell H1: **Service Hub**
- Breadcrumb: Matrix / Service Platform / Service Hub
- Browser title: Service Hub \| Matrix
- Role-aware welcome message
- Summary cards, Quick Actions, Attention Required, My Work (technicians), Operations Overview (managers/admins)
- Recent activity from live service-call records

## Related patches

- Patch 45/46 Preventive Maintenance and technician workflows are unchanged and remain linked from the Service Hub.
- **51A** — Complete
- **51B.1** — Implemented: portal-submitted badge, customer status preview, customer-visible updates with visibility markers on ticket timelines, portal attention item
- **51B.2** — In progress: Mobile Technician Experience (51B.2.1–51B.2.4: work queue, Field access, signed-in identity, per-user offline storage). Remaining: handler-level authorization, legacy store/`tech-toby` migration, sign-out revocation, and real-device verification. Not complete.
