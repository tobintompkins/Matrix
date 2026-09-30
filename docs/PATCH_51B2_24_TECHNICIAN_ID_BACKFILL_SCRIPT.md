# Patch 51B.2.24 — Technician ID Backfill Script

This script is dry-run-first. It updates only primary technician ID fields that are currently empty and have an exact approved name mapping. It does not alter names, secondary assignments, unmatched work orders, or any Field rollout flag.

## 1. Review first

Use the Sync Inbox CSV export and no-write preview. Create the approved JSON mapping outside source control.

## 2. Dry run

```powershell
$env:MATRIX_TECHNICIAN_ID_MAP='{"Alex Rivera":"user_abc","Sam Patel":"user_def"}'
npx tsx scripts/backfill-technician-assignment-ids.ts
```

Review every printed work order and mapping. The dry run changes nothing.

## 3. Apply only after manager approval

```powershell
npx tsx scripts/backfill-technician-assignment-ids.ts --apply
```

## Rollback

Use the printed list to clear only the IDs added by this run if an approved correction is required. Do not remove legacy technician names.
