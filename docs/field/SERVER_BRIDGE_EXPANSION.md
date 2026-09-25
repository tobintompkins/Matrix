# Field Server Bridge Expansion

Expand only after the one-work-order pilot report passes.

## Before expansion

- [ ] Pilot report is complete and marked pass.
- [ ] Server Copy Check reports no missing work orders.
- [ ] Server Work-Order Readiness has no blocking records.
- [ ] Pilot Validation confirms the selected durable work order is ready.
- [ ] A manager knows how to set MATRIX_SERVER_FIELD_WORK_ORDERS=false.

## Small-group rollout

1. Select two to five verified work orders.
2. Confirm every selected job is copied to the server and assigned.
3. Remove MATRIX_SERVER_FIELD_PILOT_WORK_ORDER only after the group is approved.
4. Keep MATRIX_SERVER_FIELD_WORK_ORDERS=true during the monitored test.
5. Process Sync Inbox receipts and verify notes, status, parts, files, and completion.

## Rollback

Set MATRIX_SERVER_FIELD_WORK_ORDERS=false and restart the app. Field APIs then return to the established browser-backed workflow. Do not delete offline packages or server records during a rollback.

## Record

- Expansion date:
- Jobs tested:
- Technicians:
- Manager:
- Outcome:
- Follow-up work:
