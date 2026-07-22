# Patch 50C-3 — Master Administration & Administrative Record Management

## Master role

Matrix uses a single highest internal role: **`SUPER_ADMIN`**.

Do not create competing `SYSTEM_OWNER` / `MASTER_ADMIN` roles. `ADMIN` also receives all permissions for operational parity; `SUPER_ADMIN` is the designated owner-level role.

### Owner access migration

```bash
npx tsx scripts/ensure-master-owner-access.ts
```

Configure (recommended):

```env
MATRIX_OWNER_EMAIL=you@company.com
# or
MATRIX_OWNER_CLERK_USER_ID=user_xxx
```

Behavior:

- Locates the primary owner safely (env match, or exactly one active ADMIN/SUPER_ADMIN directory user)
- Promotes directory role to `SUPER_ADMIN` when appropriate (never downgrades)
- Does not create duplicate users
- Does not overwrite an existing Clerk identity
- Refuses customer portal roles
- Writes `MASTER_ADMIN_ROLE_ASSIGNED` / `MASTER_ADMIN_ACCESS_VERIFIED` audit events
- Is idempotent

Clerk live access still resolves from `publicMetadata.matrixRole`. Set `matrixRole: "SUPER_ADMIN"` on the owner’s Clerk user for production. Locally, missing metadata falls back to `SUPER_ADMIN`.

## Administrative Record Management

Reuses Patch 49B Data Administration overlays:

| Area | Route |
|------|--------|
| Data Administration hub | `/admin/data` |
| Customers | `/admin/customers` |
| Machines / Systems | `/admin/machines` |
| Parts | `/admin/inventory` |
| PM | `/admin/preventive-maintenance` |
| Archived Records | `/admin/archived-records` |
| Deleted Records | `/admin/deleted-records` |
| Managed Content | `/admin/managed-content` |
| Role Simulator | `/admin/role-simulator` |

### Actions

View · Edit · Archive · Restore · Permanent Delete (eligible only) · View History / Deletion Preview

Archive is the normal removal path when business history exists. Permanent deletion is blocked when service, PM, meter, parts, approval, portal, document, or related history is present.

### New permissions

- `EDIT_ADMIN_RECORD`
- `ARCHIVE_ADMIN_RECORD`
- `RESTORE_ADMIN_RECORD`
- `DELETE_ADMIN_RECORD_PERMANENTLY`
- `VIEW_ARCHIVED_RECORDS`
- `MANAGE_ADMIN_CONTENT`
- `VIEW_ROLE_SIMULATOR`
- `SIMULATE_ROLE_PERMISSIONS`

## Role Simulator

`/admin/role-simulator` previews permission surfaces for any role without mutating Clerk or directory assignments.

## Managed Content

Sanitized plain-text content only (HTML stripped). Supports draft → publish → unpublish → archive → restore → delete draft. No source-code or generic database editor.

## Audit events

Uses `writeAdminAudit` / System Logs taxonomy, including:

- `MASTER_ADMIN_ACCESS_VERIFIED`
- `MASTER_ADMIN_ROLE_ASSIGNED`
- `ADMIN_RECORD_*` / `ADMIN_CONTENT_*` (classified under DATA_CHANGE)
