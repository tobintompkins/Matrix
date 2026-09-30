# Patch 51B.2.22 — Technician ID Backfill Review Export

## Purpose

Let managers export the work orders that need technician-ID review before any production backfill. The export is a review artifact only; it cannot change a work order.

## Included

- **Download review CSV** on Technician Assignment ID Coverage
- Name-fallback rows with work-order ID, number, and current technician name
- Unassigned rows for separate assignment cleanup
- CSV escaping and focused unit coverage

## Validation

```powershell
npx tsx --test lib/field/technician-id-coverage.test.ts
npx eslint app/field/sync-inbox/FieldTechnicianIdCoverageCard.tsx lib/field/technician-id-coverage.ts
```

## Rollback

Revert this patch. It only downloads client-side CSV data already loaded by the coverage report.
