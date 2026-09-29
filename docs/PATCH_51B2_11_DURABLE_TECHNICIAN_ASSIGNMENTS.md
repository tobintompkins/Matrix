# Patch 51B.2.11 — Durable technician assignment IDs

## What this adds

- Nullable `assignedTechnicianId` and `secondaryTechnicianId` on durable `WorkOrder` rows (Clerk Matrix user ids).
- Shared assignment matching in `lib/work-orders/field-technician-assignment.ts`: **ID match first**, then **legacy name fallback** so existing name-only assignments keep working during migration.
- Field API authorization (`canAccessFieldWorkOrder`), sync receipt authorization, package downloads, and work-session validation use the shared matcher.
- Server work-order reads/writes (`mapServerWorkOrder`, office create/assignment PATCH) persist and return both names and ids.
- Field home / next-job queue filtering accepts Clerk `userId` plus `technicianName`.

Names are **not** removed. Office and dispatch may continue sending `assignedTechnician` / `secondaryTechnician` only until ids are backfilled.

## Controlled migration

1. Apply Prisma migration `20260929120000_work_order_technician_ids`.
2. Run `npx prisma generate` in deployment environments that compile against the client.
3. For new server assignments, send **both** display name and Clerk `userId` on `PATCH /api/work-orders/server/[workOrderKey]/assignment`:
   - `assignedTechnician`, `assignedTechnicianId`
   - `secondaryTechnician`, `secondaryTechnicianId` (optional)
4. Backfill existing durable rows in a controlled window (script or one-off SQL) by mapping current name fields to Clerk user ids. Until backfill completes, Field APIs continue to authorize via names.
5. Enable `MATRIX_SERVER_FIELD_WORK_ORDERS` only after verifying a pilot work order with ids + names for assigned technicians.
6. Confirm `/api/field/sync`, `/api/field/packages`, and `/api/field/sessions` allow the signed-in technician when matched by id **or** name.

## Rollback

1. **Do not** drop name columns or clear `assignedTechnician` / `secondaryTechnician`.
2. Set `MATRIX_SERVER_FIELD_WORK_ORDERS=false` to return Field reads to the browser repository (names only).
3. Optional: stop writing `assignedTechnicianId` / `secondaryTechnicianId` from office tools; authorization falls back to names automatically.
4. Re-run Field API tests: `npx tsx --test lib/work-orders/field-technician-assignment.test.ts lib/field/api-authorization.test.ts`.

## Validation

```bash
npx tsx --test lib/work-orders/field-technician-assignment.test.ts lib/field/api-authorization.test.ts lib/field/mobile-work-queue.test.ts lib/work-orders/server-office-write.test.ts
```

With configured Clerk users: assign a work order with ids on the server, sign in as that technician, and confirm package download and sync receipt acceptance; sign in as a different technician and confirm `404` / `REJECTED`.
