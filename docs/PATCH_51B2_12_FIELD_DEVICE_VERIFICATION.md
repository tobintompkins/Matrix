# Patch 51B.2.12 — Field Device Verification checklist

## What this adds

Managers with access to **Field → Sync Inbox** see a **Field Device Verification** section above server readiness panels. It tracks real-device test results for:

- Assigned work order download
- Offline note, part, photo, and signature
- Interrupted sync / retry
- Conflict handling
- Work order completion

Each row supports **Not tested**, **Pass**, or **Fail**. Managers record **tester**, **device**, **browser**, **test date**, and **session notes**. A release-readiness banner summarizes whether testing is incomplete, blocked by failures, or ready for sign-off.

## Boundaries

- The **working draft** stays in **browser `localStorage`** (`matrix-field-device-verification-v1`).
- Optional **server submit** for finalized records is documented in [PATCH_51B2_13_FIELD_DEVICE_VERIFICATION_SERVER.md](./PATCH_51B2_13_FIELD_DEVICE_VERIFICATION_SERVER.md).
- No changes to Field sync, bridge rollout, office migration, or technician workflows.

## How to record a real-device test

1. Sign in as a manager (`VIEW_FIELD_ALL_TECHNICIANS` or `MANAGE_WORK_ORDERS`).
2. Open **Field → Sync Inbox** (or **Field Data → Review Server Sync Inbox** from settings).
3. Perform the scenarios on the target phone, tablet, or laptop using the normal Field app (see [FIELD_REAL_DEVICE_READINESS.md](./FIELD_REAL_DEVICE_READINESS.md)).
4. After each scenario, set **Pass** or **Fail** on the matching checklist row. Leave **Not tested** until the scenario was attempted.
5. Fill in tester, device, browser, and test date. Add session notes for build numbers, network conditions, or defects.
6. Click **Submit finalized record** to store a manager-visible server copy (requires migration 51B.2.13), or **Copy release record** for tickets and [BRIDGE_PILOT_SIGNOFF.md](./field/BRIDGE_PILOT_SIGNOFF.md).
7. Optional: expand **Export text preview** to review the full record before filing.

Repeat on each device class (phone, tablet, laptop). Each browser profile keeps its own local checklist until you reset or overwrite it.

## Release readiness rules

| State | Meaning |
| --- | --- |
| **Incomplete** | One or more checks are still **Not tested** and none failed |
| **Blocked** | At least one check is **Fail** |
| **Ready** | All eight checks are **Pass** |

Release-ready on the checklist does **not** enable the server bridge or change environment flags. It is evidence for human go/no-go review only.

## Rollback

Use **Reset local checklist** on the Sync Inbox page to clear this browser’s record. Clearing local storage or using a private window removes the checklist without affecting Field data or server receipts.

## Validation

```bash
npx tsx --test lib/field/device-verification.test.ts
```
