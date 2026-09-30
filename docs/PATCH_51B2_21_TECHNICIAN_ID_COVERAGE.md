# Patch 51B.2.21 — Technician Assignment ID Coverage

## Purpose

Show managers how many Work Orders already have durable technician IDs and which still depend on legacy name matching. This is preparation for a safe production-data backfill; it does not change any assignment.

## Included

- `GET /api/field/technician-id-coverage` guarded by `VIEW_FIELD_ALL_TECHNICIANS`
- A read-only **Technician Assignment ID Coverage** card on Sync Inbox
- Primary and secondary ID totals, name-fallback list, and unassigned count
- Focused coverage calculation test

## Validation

```powershell
npx tsx --test lib/field/technician-id-coverage.test.ts
npx eslint app/api/field/technician-id-coverage/route.ts app/field/sync-inbox/FieldTechnicianIdCoverageCard.tsx lib/field/technician-id-coverage.ts
```

## Rollback

Revert this patch. It is read-only and does not migrate, backfill, or modify a Work Order.
