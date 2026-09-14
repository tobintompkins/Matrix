# Patch 51B.2.8 — Durable Field sync receipts

The authenticated Field sync API now records each authorized offline operation in Matrix's existing Prisma `OfflineOperation` table. The server derives the owner and technician name from Clerk; browser-supplied actor information is not trusted. Repeating the same `operationId` is safe and returns `DUPLICATE` instead of creating another record.

This is a durable receipt, not the final business update. The browser queue continues to use the existing local workflow, and a later patch will process these receipts into real server work-order, parts, maintenance, and attachment records. A receipt must not be treated as a completed work-order change.

The existing `20260710120000_field_offline_sync` Prisma migration provides this table. Run `npx prisma migrate status` before using the API in a new environment. Do not reset the database.
