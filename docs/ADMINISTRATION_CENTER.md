# Enterprise Administration Center (Patches 49A–50A)

Matrix preserves historical operational and audit records when user access is deactivated. Deactivation removes access but does not erase work history.

Matrix uses archival and soft deletion to preserve operational history. Permanent deletion is restricted and must never compromise service, inventory, financial, warranty, compliance, or audit integrity.

Matrix administrative tools never provide unrestricted SQL, command-shell, source-code, credential, or file-system access. All administration actions are permission-controlled, scoped, validated, and audited.

## Navigation (final)

```text
Overview
Access — Users, Roles, Security
Data — Data Admin, Service Calls, Customers, Machines, PM, Meters, Inventory, Deleted Records
Configuration — System Config, Organization, Features, Notifications, Announcements, Matrix Assist, Portal
Insights — Executive Dashboard, **Approval Center**, Admin Reports, Usage & Adoption, Audit History
System — System Health, Background Jobs, Backups, Integrations, Import & Export, Admin Tools, Version
```

Only permitted sections appear for the signed-in role.

## Routes (49C additions)

| Route | Permission |
|-------|------------|
| `/admin/executive` | `VIEW_EXECUTIVE_ADMIN_DASHBOARD` |
| `/admin/approvals` | `VIEW_APPROVAL_CENTER` |
| `/admin/reports` | `VIEW_ADMIN_REPORTS` |
| `/admin/usage` | `VIEW_USAGE_ANALYTICS` |
| `/admin/system-health` | `VIEW_SYSTEM_HEALTH` |
| `/admin/jobs` | `VIEW_BACKGROUND_JOBS` |
| `/admin/backups` | `VIEW_BACKUP_STATUS` |
| `/admin/import-export` | `EXPORT_OPERATIONAL_DATA` |
| `/admin/integrations` | `VIEW_INTEGRATIONS` |
| `/admin/notifications` | `MANAGE_NOTIFICATION_SETTINGS` |
| `/admin/announcements` | `MANAGE_ANNOUNCEMENTS` |
| `/admin/tools` | `VIEW_ADMIN_TOOLS` |
| `/admin/version` | `VIEW_VERSION_INFORMATION` |

See also [APPROVAL_CENTER.md](./APPROVAL_CENTER.md) for Patch 50A.

## Executive Dashboard

Scoped operational cards from existing service-call, machine, customer, inventory, and deleted-record stores. Soft-deleted records are excluded. PM compliance percentages are **not fabricated** when live PM aggregates are unavailable.

Directors receive executive visibility without destructive tools.

## Admin Reports & Exports

CSV exports via existing Blob download pattern. Sensitive secrets are never exported. Scheduled report delivery is **deferred** (no email/job queue).

## System Health

Checks: Application, Database connectivity, Clerk configuration, AI provider, Email (not configured), Storage (unknown/placeholder), Jobs (in-app history), Backups (hosting-managed). Statuses use plain-language labels: Operational, Degraded, Configuration Required, Unavailable, Unknown.

## Background Jobs

No external queue exists. Admin Tools / Import / Export record runs in an in-app job history. Failed **idempotent** jobs may be retried; unsafe duplicate retries are blocked.

## Backups

Visibility only. Manual backup and production restore are **not available from Matrix** and must be managed by the hosting provider / DBA.

## Import & Export

Staged CSV import for Customers and Parts (validate → process). Machines validate only (digital twin seed is read-only). Formula-injection prefixes are sanitized. Row limit: 500. Exports: Customers, Machines, Service Calls, Parts.

## Integrations

Catalog of real integrations (Clerk, Matrix Assist, SQLite) and honest **Not Supported** entries (Email, Webhooks). Secrets are never returned to the browser.

## Notifications

In-app notification prototype remains session-based. Email / Push / SMS administration is documented as unavailable until a provider exists.

## Announcements

Organization announcements with sanitized plain text, audience, dates, and archive. Displayed for Service Hub consumption via `listActiveAnnouncementsForHub()`.

## Admin Tools

Scan-only relationship validation, duplicate candidate review, system diagnostics. No SQL shell, command execution, or file-system browser. High-risk tools require confirmation + reason.

## Custom Fields

Metadata foundation (short/long text, number, date, checkbox, single select). Non-executable. Deactivate instead of delete. Max 25 active fields.

## Maintenance Mode

Session-scoped toggle for administrators (not a full application lockout platform feature). Documented as limited.

## Access Reviews

Security Center supports review statuses. Access is **not** removed automatically — deactivate via Users & Access.

## Migration

No new Prisma migration required for 49C overlays. Existing 49A foundation:

```bash
npx tsx scripts/apply-admin49a-migration.ts
npx prisma generate
npm test
npx tsc --noEmit
npm run build
```

## Deferred / infrastructure limits

- Scheduled report email delivery
- Real background job queue / retention purge
- Hosted backup verification and Matrix-triggered restore
- Email/SMS/push providers and webhook admin
- Live permission matrix editor
- Full customer merge
- Permanent deletion with dependent-record purge
- User impersonation

## Testing

```bash
npm test
```
