# Office Work Orders Server Migration

## Goal

Move the office Work Orders queue from browser session storage to durable Prisma WorkOrder records while preserving the current workflow during the cutover.

## Delivery sequence

1. Add server list and detail APIs with manager permission checks. (`GET /api/work-orders/server`, `GET /api/work-orders/server/[workOrderKey]`, `MANAGE_WORK_ORDERS`, read-only.)
2. Add server create, assignment, status, note, part, labor, and attachment APIs. (`POST /api/work-orders/server`; `PATCH`/`POST` under `/api/work-orders/server/[workOrderKey]/…`, `MANAGE_WORK_ORDERS`, timeline + audit in transactions.)
3. Update the office queue to read from server records behind a disabled feature flag. (`MATRIX_SERVER_OFFICE_WORK_ORDERS`; Work Orders list/detail fetch `/api/work-orders/server` when enabled; browser queue remains default.)
13. Connect the office Work Orders UI to server APIs when the flag is on and rollout allows the signed-in user (`lib/work-orders/office-server-mutations.ts`; list/detail/create/assignment/schedule/status/notes/parts/labor/attachments; browser session storage unchanged when flag is off or rollout falls back; timeline and audit refresh after server writes).
4. Manager-only browser/server comparison view (read-only; Work Orders → Compare Queues; matches by work-order number and legacy browser ID). 
5. Office Server Queue Rollout Guard (manager-only; `POST /api/work-orders/server-rollout-guard`; blocks rollout when comparison finds gaps or mismatches; browser queue remains rollback).
6. Controlled manager-only office server queue rollout (`resolveOfficeQueueRollout`; server queue when `MATRIX_SERVER_OFFICE_WORK_ORDERS=true` and guard is ready for `MANAGE_WORK_ORDERS`; browser fallback with explanation when guard is blocked; active/rollback banner on list and detail).
7. Document and validate browser rollback while the flag stays off or during controlled rollout ([OFFICE_QUEUE_ROLLBACK.md](./OFFICE_QUEUE_ROLLBACK.md); `POST /api/work-orders/server-rollback-validation`; Work Orders → Validate Browser Rollback; read-only, no browser/server deletes).
8. One-manager office server queue pilot (`MATRIX_SERVER_OFFICE_PILOT_MANAGER`; `POST /api/work-orders/server-office-pilot`; audited sign-off at `/api/work-orders/server-office-pilot/signoff`; server queue only for the named manager after guard ready + approval).
9. Office Server Queue Pilot Monitoring (manager-only; `POST /api/work-orders/server-office-pilot/monitoring`; Work Orders monitoring view with flag, guard, latest sign-off, effective queue for current user, audited one-click revoke).
10. Controlled dispatcher-group office server queue rollout (`MATRIX_SERVER_OFFICE_DISPATCHER_ALLOWLIST`; audited group sign-off; server queue only for allowlisted users after pilot sign-off + guard; group monitoring and revoke).
11. Controlled office-role expansion for the server queue (`MATRIX_SERVER_OFFICE_ROLE_ALLOWLIST`; audited role expansion sign-off; requires pilot + dispatcher guardrails + rollout guard; per-user effective queue source and reason).
12. Office rollout expansion review (`POST /api/work-orders/server-office-rollout/expansion-review`; audited approve/hold/revoke at `.../expansion-review/decision`; summarizes pilot, dispatcher, and role expansion status plus comparison health; manager approval required before `MATRIX_SERVER_OFFICE_EXPANSION_BEYOND_ROLES=true` enables managers outside pilot/dispatcher/role paths; hold/revoke blocks beyond-allowlist expansion while preserving prior guardrails and browser fallback).

## Acceptance checks

- [ ] Work Order creation produces a durable server record.
- [ ] Assignment and schedule survive a browser refresh.
- [ ] Status, notes, parts, labor, attachments, and timeline are durable.
- [ ] Field packages resolve the same work-order ID.
- [ ] Browser/server comparison reports no unexpected missing records.
- [ ] Office rollback returns to the current queue without data deletion.

## Rollback

Set MATRIX_SERVER_OFFICE_WORK_ORDERS=false and restart the app. Do not remove browser records, server records, or offline packages during a rollback. Run the Step 7 browser rollback validation on the Work Orders dashboard before expanding the pilot. See [OFFICE_QUEUE_ROLLBACK.md](./OFFICE_QUEUE_ROLLBACK.md).

## Guardrails

- Existing server work-order numbers are never overwritten by import.
- Legacy browser IDs stay linked through legacyWorkOrderId.
- All office write endpoints require Matrix work-order permissions.
- The Field pilot remains independent until office validation is complete.

## Record

- Migration owner:
- First manager:
- First dispatcher group:
- Start date:
- Outcome:
