# Patch 51B.2.19 — Field Receipt Review Queue

## Purpose

Make the Sync Inbox easier for managers to operate by adding a read-only receipt review queue. It filters the existing server receipt list without changing sync data or processor behavior.

## Included

- Status filters: all, waiting to process, needs review, and applied
- Receipt-type filter and search by work order, technician, printer, receipt ID, or error text
- **Show review-needed** shortcut for rejected records
- Focused unit tests for filter and search behavior

## Validation

```powershell
npx tsx --test lib/field/sync-receipt-queue.test.ts
npx eslint app/field/sync-inbox/FieldSyncReceiptReviewQueue.tsx lib/field/sync-receipt-queue.ts
```

## Rollback

Revert this patch. It is a client-side review surface only and makes no server or database change.
