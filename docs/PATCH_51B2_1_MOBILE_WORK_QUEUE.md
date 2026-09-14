# Roadmap 51B.2 — Mobile Technician Experience, part 1
Package label: 51B.2.1 (a delivery subdivision of the roadmap's existing 51B.2 item).
Status: applied in the Matrix workspace; 51B.2 remains in progress (not complete).

## Changes
- Existing Field Today page shows a next-job card, including customer, site, schedule and an explicit Open job details action.
- Recommendation includes primary and secondary assignments, excludes draft/closed/blocked work and future-day visits, and prioritizes active, critical and overdue work.
- Assigned Work retains all filters, prioritizes matching work, shows a result count and offers a clear-filter recovery action.
- Download and sync actions show pending/error feedback and disable repeated clicks while pending.
- Removes the fabricated PM-due-soon value of 2; no replacement zero is represented as measured PM data.
- Routes, job status actions, data models, existing Field tools and the UI cleanup remain intact.

## Validation
Five queue behavior tests pass (TypeScript transpiled to CommonJS, run with Node's test runner).
Targeted ESLint passes.
TypeScript validation performed against a copied source snapshot with this patch overlaid.
No signed-in browser or physical-device verification completed.

## Remaining 51B.2 work
This is not a complete mobile release.
Existing fixed demo technician identities, user-scoped offline storage and server-side access enforcement must be addressed consistently across all Field screens before a multi-user rollout.
Verify offline download/reopen, interrupted sync, conflicting updates, notes/photos/signatures and completion on real devices.
Do not infer production readiness from this patch's passing local checks.
No Onyx integration is included; that is a separate proposed Matrix Assist integration.
