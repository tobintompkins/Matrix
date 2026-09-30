# Patch 51B.2.16 — Field Sync Operations

## Purpose

Give managers one read-only receipt-queue health view on **Field → Sync Inbox** before they process Field changes. This patch does not enable the server bridge, change release decisions, or alter any receipt processing behavior.

## What is included

- `GET /api/field/sync/health` guarded by `VIEW_FIELD_ALL_TECHNICIANS`
- Receipt totals for waiting (`RECEIVED`), applied (`APPLIED`), and review-needed (`REJECTED`) records
- Per-type counts for notes, status changes, completions, photos, attachments, and parts
- Oldest waiting receipt timestamp
- A manager-only **Field Sync Operations** card on Sync Inbox

## Operating procedure

1. Open **Field → Sync Inbox** and refresh receipt queue health.
2. Review **Needs review** records and their errors in the existing receipt list.
3. Select **Process Received Receipts** for the existing controlled processor.
4. Refresh health to verify the queue changed as expected.
5. Keep Field release approval and bridge flags under their existing controlled rollout procedures.

## Validation

```powershell
npx tsx --test lib/field/sync-operations-health.test.ts
npx eslint app/api/field/sync/health/route.ts app/field/sync-inbox/FieldSyncOperationsCard.tsx lib/field/sync-operations-health.ts
```

## Rollback

Revert this patch. It is read-only and does not modify receipt records, Field sync, release decisions, or rollout environment flags.
