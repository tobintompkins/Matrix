# AI Automation Framework — Patch 51A.2

Extends the AI Operations Center (51A.1). Does **not** create a second AI system.

## Route

`/ai-operations/automations` · `/ai-operations/automations/[id]`

Tabs: Overview · Library · Builder · History · Approvals · Templates · Settings

## Permissions

`VIEW_AI_AUTOMATIONS`, `CREATE_AI_AUTOMATIONS`, `EDIT_AI_AUTOMATIONS`, `ENABLE_AI_AUTOMATIONS`, `RUN_AI_AUTOMATIONS`, `VIEW_AI_AUTOMATION_HISTORY`, `APPROVE_AI_AUTOMATIONS`, `MANAGE_AI_AUTOMATION_SETTINGS`, `MANAGE_AI_AUTOMATION_TEMPLATES`

- ADMIN / SUPER_ADMIN: full access via `ALL_PERMISSIONS`
- SERVICE_MANAGER: view, run, history, approve

## Schema (additive)

| Table | Model |
|-------|--------|
| `ai_automation_definitions` | `AiOpsAutomationDefinition` |
| `ai_automation_executions` | `AiOpsAutomationExecution` |
| `ai_automation_approvals` | `AiOpsAutomationApproval` |
| `ai_automation_templates` | `AiOpsAutomationTemplate` |
| `ai_automation_events` | `AiOpsAutomationEvent` |
| `ai_automation_settings` | `AiOpsAutomationSetting` |

Migration: `20260714240000_ai_automation_51a2`  
Apply: `npx tsx scripts/apply-ai51a2-migration.ts`

## Scheduler

`POST /api/internal/automations/run-scheduled`

Requires `AUTOMATION_CRON_SECRET` (Bearer or `x-automation-cron-secret`).

Railway cron example:

```text
Schedule: */15 * * * *
URL: https://<host>/api/internal/automations/run-scheduled
Header: Authorization: Bearer <AUTOMATION_CRON_SECRET>
```

## Event integration

`emitAutomationEvent()` — wired on **service call created** (`lib/service-calls/repository.ts`).

## Safety

- No autonomous delete, role changes, stock deduction, PM completion, or external customer send
- High-impact actions pause for approval
- Dry-run default for manual runs
- Condition engine uses safe path resolution (no `eval`)
- Idempotency keys prevent duplicate completed runs

## How to add a trigger

1. Register in `lib/automations/registry/triggers.ts`
2. Call `emitAutomationEvent({ eventType, entityType, entityId, payload })` from a mutation
3. Create/activate an automation with matching `eventType`

## How to add an action

1. Register in `lib/automations/registry/actions.ts`
2. Implement executor branch in `executeRegisteredAction`
3. Mark `highImpact: true` when approval is required
