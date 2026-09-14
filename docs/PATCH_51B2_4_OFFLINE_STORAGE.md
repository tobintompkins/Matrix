# 51B.2.4 - Per-user Field Offline Storage

This is a delivery subdivision of roadmap item 51B.2, Mobile Technician Experience.
Status: applied in the Matrix workspace. 51B.2 remains in progress (not complete).

## What changes

New Field offline records use a separate IndexedDB database for each signed-in Clerk user. The Field identity provider selects that database before Field pages mount. Switching users changes the storage scope. The existing `matrix-field-offline-v1` database is preserved and is not copied, renamed, cleared, or reassigned.

## What this does not complete

This patch does not migrate legacy offline data, protect device-level browser profiles, revoke already-open offline pages, or add server record authorization. It does not make the mobile module production-ready. A subsequent migration/review decision is required before old offline records are deleted.

## Acceptance

Use two configured technician accounts on the same browser profile. Each account should see only its own new offline package, queue item, session and metadata. Sign out and sign back in before drawing conclusions. Confirm the old legacy data remains unmodified. Test normal download, save, sync retry and cleanup only on newly-created scoped data.
