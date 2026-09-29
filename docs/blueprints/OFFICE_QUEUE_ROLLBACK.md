# Office Queue Browser Rollback (Step 7)

Validate that the browser work-order queue remains the safe rollback path while the office server migration stays behind `MATRIX_SERVER_OFFICE_WORK_ORDERS`.

## When to run

- Before turning `MATRIX_SERVER_OFFICE_WORK_ORDERS=true` for a one-manager pilot (Step 8).
- After any server-queue session where managers used the durable office queue.
- After a failed rollout guard or comparison.

## Manager workflow

1. Open **Work Orders** as a user with `MANAGE_WORK_ORDERS`.
2. Run **Compare Queues** and **Check Rollout Readiness** (Steps 4–5).
3. Run **Validate Browser Rollback** (Step 7 card). All checks must pass.
4. Record results in the health check table below.

The validation call is read-only: `POST /api/work-orders/server-rollback-validation` with the current browser queue and a snapshot fingerprint. It does not import, update, or delete browser or server records.

## Rollback procedure

1. Set `MATRIX_SERVER_OFFICE_WORK_ORDERS=false` in the deployment environment.
2. Restart the Matrix application.
3. Confirm the Work Orders list shows the **browser-default** or **browser-rollback** banner (not **server-active**).
4. Re-run **Validate Browser Rollback** and confirm browser record counts match expectations.
5. Do **not** clear browser session storage or delete server `WorkOrder` rows during rollback.

Automatic fallback: while the flag is `true`, managers still use the browser queue when the rollout guard is blocked or pending. Non-managers always use the browser queue.

## Health check record

| Check | Result | Evidence |
| --- | --- | --- |
| Browser/server compare clean | pass / fail | |
| Rollout guard ready | pass / fail | |
| Browser rollback validation (Step 7 UI) | pass / fail | |
| Browser record count unchanged after validation | pass / fail | |
| Env flag rollback documented | pass / fail | |

## Step 8 — One manager pilot

Do not start Step 8 until every required row above is **pass**.

1. Set `MATRIX_SERVER_OFFICE_PILOT_MANAGER` to the pilot manager email, Clerk user id, or display name.
2. Name the pilot manager in [WORK_ORDERS_SERVER_MIGRATION.md](./WORK_ORDERS_SERVER_MIGRATION.md) (Record section).
3. Set `MATRIX_SERVER_OFFICE_WORK_ORDERS=true` in a controlled environment only.
4. On Work Orders, run **Refresh Pilot Status**, then have the **named pilot manager** click **Approve Pilot** (audited).
5. Confirm **server-active** banner and durable queue behavior for that manager only.
6. Run **Validate Browser Rollback** again before expanding to a small dispatcher group.
7. If anything fails, **Revoke** sign-off, set the flag to `false`, restart, and return to the browser queue without deleting data.

## Step 10 — Dispatcher group

After the one-manager pilot is stable:

1. Set `MATRIX_SERVER_OFFICE_DISPATCHER_ALLOWLIST` with approved dispatcher identities only.
2. Confirm named manager pilot sign-off remains **approved** and rollout guard is **ready**.
3. Approve the dispatcher group on Work Orders (audited).
4. Use **Dispatcher Group Office Server Queue Rollout** monitoring to verify per-user server vs browser indicators.
5. **Revoke Group Access** returns allowlisted users to browser fallback without deleting data.

## Step 11 — Office role expansion

After pilot and dispatcher group are stable:

1. Set `MATRIX_SERVER_OFFICE_ROLE_ALLOWLIST` to approved Matrix roles only (comma-separated).
2. Confirm pilot sign-off and dispatcher group sign-off remain **approved**, and rollout guard is **ready**.
3. Approve **Office Role Expansion** on Work Orders (audited manager sign-off).
4. Users whose Matrix role is on the allowlist see **server-active-role** when all gates pass; all other roles stay on browser fallback.
5. **Revoke Role Expansion** returns approved-role users to the browser queue without deleting browser or server records. Pilot and dispatcher guardrails remain enforced.

## Step 12 — Office rollout expansion review

After role expansion is stable:

1. Confirm pilot, dispatcher group, and role expansion sign-offs remain **approved**, and rollout guard plus browser/server comparison are **ready**.
2. On Work Orders, run **Refresh Expansion Review** and review pilot/dispatcher/role status, comparison health, and recent rollout audit decisions.
3. Record **Approve Expansion Review** (audited) before setting `MATRIX_SERVER_OFFICE_EXPANSION_BEYOND_ROLES=true` for controlled expansion beyond the configured role allowlist.
4. Managers who are not on the pilot, dispatcher, or role paths may see **server-active-expansion-review** only when the beyond-roles flag is on and expansion review is **approved**.
5. **Hold Expansion** or **Revoke Expansion** (audited) blocks beyond-allowlist server access without removing pilot, dispatcher, or role allowlist guardrails. Set the office flag to `false` or use Step 7 validation if a full rollback is required.

## Related code

- `lib/work-orders/office-queue-rollback.ts` — snapshot + validation checks
- `lib/work-orders/office-queue-rollout.ts` — effective browser vs server source (Step 6)
- `app/work-orders/WorkOrdersOfficeRollbackCard.tsx` — dashboard UI
- `lib/work-orders/office-rollout-expansion-review.ts` — Step 12 expansion review readiness and beyond-allowlist eligibility
- `app/work-orders/WorkOrdersOfficeRolloutExpansionReviewCard.tsx` — Step 12 dashboard UI
