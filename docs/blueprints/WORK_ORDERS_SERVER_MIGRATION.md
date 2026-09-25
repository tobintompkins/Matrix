# Office Work Orders Server Migration

## Goal

Move the office Work Orders queue from browser session storage to durable Prisma WorkOrder records while preserving the current workflow during the cutover.

## Delivery sequence

1. Add server list and detail APIs with manager permission checks. (`GET /api/work-orders/server`, `GET /api/work-orders/server/[workOrderKey]`, `MANAGE_WORK_ORDERS`, read-only.)
2. Add server create, assignment, status, note, part, labor, and attachment APIs. (`POST /api/work-orders/server`; `PATCH`/`POST` under `/api/work-orders/server/[workOrderKey]/…`, `MANAGE_WORK_ORDERS`, timeline + audit in transactions.)
3. Update the office queue to read from server records behind a disabled feature flag. (`MATRIX_SERVER_OFFICE_WORK_ORDERS`; Work Orders list/detail fetch `/api/work-orders/server` when enabled; browser queue remains default.)
4. Manager-only browser/server comparison view (read-only; Work Orders → Compare Queues; matches by work-order number and legacy browser ID). 
5. Office Server Queue Rollout Guard (manager-only; `POST /api/work-orders/server-rollout-guard`; blocks rollout when comparison finds gaps or mismatches; browser queue remains rollback).
6. Controlled manager-only office server queue rollout (`resolveOfficeQueueRollout`; server queue when `MATRIX_SERVER_OFFICE_WORK_ORDERS=true` and guard is ready for `MANAGE_WORK_ORDERS`; browser fallback with explanation when guard is blocked; active/rollback banner on list and detail).
7. Keep the current browser repository as a rollback path until office validation passes.
8. Enable for one manager, then a small dispatcher group.

## Acceptance checks

- [ ] Work Order creation produces a durable server record.
- [ ] Assignment and schedule survive a browser refresh.
- [ ] Status, notes, parts, labor, attachments, and timeline are durable.
- [ ] Field packages resolve the same work-order ID.
- [ ] Browser/server comparison reports no unexpected missing records.
- [ ] Office rollback returns to the current queue without data deletion.

## Rollback

Set MATRIX_SERVER_OFFICE_WORK_ORDERS=false. Do not remove browser records, server records, or offline packages during a rollback.

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
