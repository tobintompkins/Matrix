# Patch 51B.2.5 — Field API authorization

## What this adds

- Requires a signed-in Clerk user with the appropriate Matrix permission for Field sync, work-session validation, and offline package APIs.
- Rejects the local development role fallback at the API boundary.
- Allows technicians to access only work orders assigned to them as primary or secondary technician; dispatch-capable roles retain access to all assignments.
- Uses the signed-in identity for authorization and no longer accepts `technicianId` from the request body as proof of identity.
- Filters package downloads and returns `404` for a work order that is outside the technician's assignment.

## Clerk setup required before live API use

Set each user's public metadata with a configured `matrixRole`. For technicians, also set `technicianName` exactly as it appears in the work-order assignment fields. The current prototype matches names because work orders do not yet store stable technician IDs.

## Current boundary

The work-order repository still writes to the browser's `sessionStorage`. Therefore the `/api/field/sync` and `/api/field/sessions` handlers authorize and validate requests but intentionally do not persist field changes. The current browser offline flow remains unchanged. A later patch must move work orders and related records to the server repository before the client sends its queue to these handlers for real synchronization.

## Validation

Run `npm test` and `npm run lint`. Then, with configured Clerk users, verify that a technician can request only their own package while a service manager can request an assigned technician's package.
