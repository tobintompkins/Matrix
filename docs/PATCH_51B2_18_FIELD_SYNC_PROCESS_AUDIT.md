# Patch 51B.2.18 — Field Sync Processor Audit

## Purpose

Create an audited record whenever a manager runs the existing Field receipt processor. This closes the operations-history gap without changing receipt validation, processor behavior, release decisions, or rollout flags.

## Included

- An audit record for every completed `POST /api/field/sync/process` run
- Totals for scanned, applied, and waiting receipts, with per-type results
- `GET /api/field/sync/process-runs` for the twelve most recent manager runs
- A **Receipt Processor History** card on Field → Sync Inbox
- Focused unit tests for payload and saved-run mapping

## Operating procedure

1. Review the Field Sync Operations card and any rejected receipt errors.
2. Use the existing **Process Received Receipts** button.
3. Refresh **Receipt Processor History** to record who ran the batch and its outcome.
4. If an audit warning appears, preserve the displayed processor result and notify an administrator before the next release decision.

## Validation

```powershell
npx tsx --test lib/field/field-sync-process-audit.test.ts
npx eslint app/api/field/sync/process/route.ts app/api/field/sync/process-runs/route.ts app/field/sync-inbox/FieldSyncProcessHistoryCard.tsx lib/field/field-sync-process-audit.ts
```

## Rollback

Revert this patch. Existing processor behavior and all receipt records remain intact.
