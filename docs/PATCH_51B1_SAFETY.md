# Patch 51B.1 — Rollback and Safety Record

Recorded when applying `04_ROLLBACK_AND_SAFETY.md` after implementation.

## Branch

- **Safety / integration branch:** `patch/51b-1-customer-portal-integration`
- **Rollback base:** `master` at `f7ec5c2` (`new backup`)

## Validation baseline (post-51B.1)

| Gate | Result | Notes |
|------|--------|--------|
| Typecheck (`npx tsc --noEmit`) | Pass | 2026-07-22 |
| ESLint (patched portal/hub files) | Pass | 2026-07-22 |
| Unit tests (`npm test`) | Pass — 347 | Full suite; portal 51B.1 suite 11/11 |
| Production build | Pass | `MATRIX_DIST_DIR=.next-validate` |

## Database / migrations

- Portal migration is **additive only:** `prisma/migrations/20260714110000_enterprise_customer_portal_51b/`
- Apply script: `npx tsx scripts/apply-portal51b-migration.ts`
- Dev DB: use disposable SQLite / local Prisma DB; do **not** delete shared production records on rollback
- Environment files (`.env.local`) were **not** overwritten or committed

## Rollback procedure

1. Prefer revert of the latest phase/checkpoint commit on this branch.
2. If needed, switch back to pre-patch `master` (`f7ec5c2`) or restore that branch state.
3. Roll back only the new portal migration with the repo’s apply/migrate docs — do not hand-delete shared CRM/service records.
4. Old portal routes (`/portal/tickets`, `/portal/printers`, `/portal/maintenance`) remain; aliases were additive.

## Patch manifest

See `docs/patches/05_PATCH_MANIFEST_51B_1.json`.

- **Type:** integration (not a second portal)
- **Depends on:** 51A.1 → 51A.5 Part 3 (complete)
- **Next:** 51B.2 — Mobile Technician Experience
