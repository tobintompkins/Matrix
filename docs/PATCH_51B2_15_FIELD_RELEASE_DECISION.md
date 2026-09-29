# Patch 51B.2.15 — Field Release Decision record

## What this adds

From **Field → Sync Inbox → Field Release Readiness**, authorized managers can record an audited **approve**, **hold**, or **revoke** decision for Field release readiness.

- Decisions are stored in the **server audit log** (`FieldReleaseDecision` / `field-release-decision-v1`).
- Each entry captures an optional note, the manager identity, and a **snapshot** of the current readiness summary (state, verification submission id, tester/device/date context).
- **Approve** is allowed only when the latest finalized device verification is **release-ready** (all scenarios passed).
- **Hold** and **revoke** are always available to managers with Sync Inbox access.

API:

- `GET /api/field/release-readiness` — includes `latestDecision` and `recentDecisions` (51B.2.14 extended)
- `POST /api/field/release-decision` — body: `{ decision, note?, confirmation }`

Confirmation strings match `lib/field/field-release-decision.ts` (approve uses `FIELD_RELEASE_DECISION_APPROVE`; hold/revoke use full audited phrases).

## Boundaries (unchanged)

- Does **not** enable Field sync processing, bridge flags, office rollout, or modify verification submissions.
- Decisions are change-management evidence only.

## Validation

```bash
npx tsx --test lib/field/field-release-decision.test.ts lib/field/field-release-readiness.test.ts
```

Sign in as a manager, submit a finalized verification when ready, **Approve release**, then confirm **Latest release decision** and **Recent release decisions** update after refresh.
