# Matrix Assist (Patch 48)

Matrix Assist is an advisory technician-support feature. It does not replace approved service procedures, safety requirements, manufacturer documentation, or technician judgment.

## Overview

Matrix Assist helps technicians diagnose symptoms, follow structured troubleshooting, summarize permitted service history, suggest related parts, and draft service notes — always with human approval before high-impact actions.

## Routes

| Route | Purpose |
|-------|---------|
| `/ai-technician` | Matrix Assist workspace (legacy path preserved) |
| `/admin/matrix-assist` | Admin settings & usage |
| `/api/matrix-assist/*` | Authenticated server APIs |

Launch points also exist on service-call diagnosis tabs, digital-twin machine pages, Service Hub quick actions, and the technician My Work area.

## Environment variables

```bash
AI_ASSIST_ENABLED=true
AI_PROVIDER=openai-compatible
AI_API_KEY=
AI_MODEL=gpt-4o-mini
AI_API_BASE_URL=https://api.openai.com/v1
AI_ASSIST_DEV_SAMPLE=true
```

- Secrets stay server-side. Never expose `AI_API_KEY` to the browser.
- When `AI_ASSIST_ENABLED=false`, Matrix Assist actions are hidden/disabled; normal service workflows continue.
- When enabled but no API key is set, the UI shows: `Matrix Assist is not configured in this environment.`
- Set `AI_ASSIST_DEV_SAMPLE=true` for deterministic local sample guidance, clearly labeled as development-only (not live AI).

## Permissions

| Permission | Typical roles |
|------------|---------------|
| `USE_MATRIX_ASSIST` | Technicians, managers, admins |
| `VIEW_MATRIX_ASSIST_SESSIONS` | Technicians (own), managers |
| `VIEW_TEAM_DIAGNOSTIC_SESSIONS` | Managers, admins |
| `MANAGE_MATRIX_ASSIST_SETTINGS` | Admins |
| `MANAGE_TROUBLESHOOTING_TEMPLATES` | Managers/admins |
| `VIEW_AI_USAGE` | Managers/admins |

Technician scoping is enforced server-side for assigned service calls.

## Data sent to the provider

Only a trimmed context summary: model, serial/asset, reported issue, priority/status, meter, prior symptoms, related call labels, and untrusted technician observations marked as reference data.

## Data not sent

Customer phones/emails, billing addresses, auth tokens, API keys, unrelated customer records, private employee notes.

## Human approval

AI drafts never automatically:

- Close service calls
- Overwrite notes
- Deduct/reserve inventory
- Place parts orders
- Become the official diagnosis

## Rate limiting

Per-user and per-organization sliding windows. Exceeding limits returns a clear message and does not block standard service-call work.

## Troubleshooting templates

Generic seeded templates live in `lib/matrix-assist/templates.ts` and `TroubleshootingTemplate` (Prisma). They are **not** official manufacturer procedures unless imported from verified documentation.

## Storage decision

Inspection checklist steps are stored relationally (`MatrixAssistDiagnosticStep`). Suggested causes use JSON on the session for flexible structured blobs.

## Migration

```bash
npx tsx scripts/apply-matrix-assist-migration.ts
npx prisma generate
```

## Testing

```bash
npm test
```

Includes context, provider, permission, rate-limit, and parts suggestion tests under `lib/matrix-assist/`.

## Unsupported in Patch 48

Autonomous repair decisions, automatic call closure, inventory mutation, vision diagnosis, live streaming (uses standard request/response), and manufacturer-document scraping.
