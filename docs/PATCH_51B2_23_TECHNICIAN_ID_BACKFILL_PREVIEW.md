# Patch 51B.2.23 — Technician ID Backfill Preview

This manager-only preview accepts explicit approved technician-name to Clerk-user-ID mappings and shows how many legacy assignments can be mapped. It never writes a Work Order.

Use it after exporting and reviewing the CSV from Patch 51B.2.22. Keep the mapping review record for the later confirmed backfill patch.

```powershell
npx tsx --test lib/field/technician-id-backfill-preview.test.ts
npx eslint app/field/sync-inbox/FieldTechnicianIdBackfillPreviewCard.tsx lib/field/technician-id-backfill-preview.ts
```
