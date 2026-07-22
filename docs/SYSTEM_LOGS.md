# System Logs Center (Patch 50C-2)

## Architecture

System Logs is a **read model and investigation UI over the existing `AuditLog` store**.

It does **not** create a second audit system.

| Layer | Location |
|-------|----------|
| Primary events | Prisma `AuditLog` (extended with taxonomy fields) |
| Security lifecycle | `SystemSecurityEventState` |
| Settings / retention / alert rules | `SystemLogSetting`, `SystemLogRetentionPolicy`, `SystemLogAlertRule` |
| Services | `lib/system-logs/` |
| APIs | `/api/system-logs/*` |
| UI | `/admin/system-logs/*` |

New writes continue to use `writeAdminAudit`, which now populates category, severity, outcome, requestId, and correlationId.

## Event taxonomy

Categories include `AUDIT`, `SECURITY`, `AUTHENTICATION`, `AUTHORIZATION`, `DATA_CHANGE`, `API`, `ERROR`, `BACKGROUND_JOB`, `IMPORT`, `EXPORT`, `INTEGRATION`, `NOTIFICATION`, `APPROVAL`, `CUSTOMER_PORTAL`, `DATA_QUALITY`, `CONFIGURATION`, and others.

Legacy rows without taxonomy fields are classified on read via `classifyAction(action)`.

## Redaction

`lib/system-logs/redaction.ts` removes passwords, tokens, secrets, authorization headers, cookies, JWTs, and related keys **server-side** before display or export.

## Request / correlation IDs

`writeAdminAudit` generates `requestId` and `correlationId` for new events. Explorer supports search by both. Related-event timeline uses shared IDs.

There is no separate distributed tracing platform.

## Security events

Security-relevant AuditLog rows can enter a lifecycle:

`OPEN → ACKNOWLEDGED → ASSIGNED → INVESTIGATING → RESOLVED | DISMISSED | FALSE_POSITIVE`

Actions require notes where configured and write privileged audit events.

## Integrations

- **Approval Center** — approval actions already written to AuditLog appear under category `APPROVAL`
- **Data Quality** — DQ actions appear under `DATA_QUALITY` with deep links
- **Customer Portal** — portal admin actions in AuditLog under `CUSTOMER_PORTAL` (no customer access to System Logs)
- **Organization Health** — receives safe aggregate metrics via `getSystemLogsAggregateForOrgHealth`

## Known limitations (honest)

- No durable background job queue (job UI in `/admin/jobs` is session-local)
- Clerk does not expose failed-login payloads or passwords to Matrix
- Notification delivery confirmation is Not Available for the session-local in-app store
- Retention settings are stored; **automated cleanup is not running** (no scheduler)
- Request/response payload logging defaults to disabled

## Permissions

See `VIEW_SYSTEM_LOGS`, `VIEW_SECURITY_LOGS`, `VIEW_SENSITIVE_LOG_METADATA`, `EXPORT_SYSTEM_LOGS`, security lifecycle permissions, and retention/settings management keys.

## Event dictionary (example)

### PERMISSION / ROLE CHANGE

- **Category:** AUTHORIZATION
- **Severity:** WARNING
- **Description:** An authorized administrator changed a user role or privileged access.
- **Required data:** Actor, affected user, action, timestamp
- **Sensitive fields:** Internal permission metadata may require `VIEW_SENSITIVE_LOG_METADATA`
- **Retention:** `AUDIT_LONG_TERM` / `SECURITY_CRITICAL`
