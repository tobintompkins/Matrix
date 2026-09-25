# Field Bridge Rollout Health Check

Complete this record before expanding the durable Field work-order bridge.

| Check | Result | Evidence |
| --- | --- | --- |
| Server Copy Check | pass / fail | |
| Server Work-Order Readiness | pass / fail | |
| Pilot Validation | pass / fail | |
| Pilot package download | pass / fail | |
| Pilot sync processing | pass / fail | |
| Pilot completion | pass / fail | |
| Pilot rollback | pass / fail | |

## Decision

- Pilot work-order:
- Technician:
- Manager:
- Date:
- Expand to small group: yes / no
- Notes:

Never expand while any required check is failing. Set MATRIX_SERVER_FIELD_WORK_ORDERS=false to return Field APIs to the established workflow.
