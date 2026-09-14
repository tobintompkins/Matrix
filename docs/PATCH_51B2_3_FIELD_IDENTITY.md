# 51B.2.3 - Signed-in Field Identity
Part of roadmap item 51B.2 Mobile Technician Experience. Applied in the Matrix workspace. 51B.2 remains in progress (not complete).

## Prerequisites
51B.2.1 and 51B.2.2 applied. Confirm intended roles in Clerk publicMetadata.
Use publicMetadata.technicianName for the existing assignment name if it differs from fullName.
This patch uses the Clerk user ID as the owner for new Field actions and packages.
It does not silently migrate records from tech-toby or other legacy owner IDs.

## Changes
Field layout requires a resolved signed-in identity before mounting Field screens.
A change in user, name or role remounts the Field subtree to avoid retaining the previous account's component state.
Fixed demo names/IDs are removed from Field home, jobs, attachments, meters, maintenance, parts, settings and profile.
Conflict resolution uses the actual role instead of a fixed SERVICE_MANAGER role.
Queue display, pending count and bulk sync use the current owner ID.
Work sessions are selected per technician so one user's session is not reused by another on the same job.
Global offline deletion buttons are temporarily disabled pending safe per-user storage isolation. Their underlying functions and legacy data are preserved.

## Not complete
The IndexedDB store remains shared. Record-level server authorization, attachment isolation, direct job access, legacy migration and sign-out/offline revocation remain open gates.
Name matching is compatibility with prototype work orders, not authorization.
Existing truck/inventory and machine prototype assignments are not comprehensively redesigned.
Do not call the mobile module production-ready.

## Validation
TypeScript and Field-targeted ESLint passed on an isolated source snapshot.
Five identity/session tests passed, including separate sessions for two technicians on the same job.
Real Clerk and browser/device validation remains open.

## Cursor acceptance
Test configured technician and missing-name cases; compare profile with Clerk.
Switch between two users: no previous user's component state should remain.
Create notes, parts entries, meter readings, maintenance entries and attachments; check owner ID and actor.
Verify assignment-name compatibility, own queue/bulk sync and actual conflict role behavior.
Review legacy pending operations before rollout; never relabel or delete them automatically.
Keep 51B.2 in progress.
