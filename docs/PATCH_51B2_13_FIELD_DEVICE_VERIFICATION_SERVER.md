# Patch 51B.2.13 — Field Device Verification server record

## What this adds

Managers can optionally **submit one finalized** Field device verification release record to the server from **Field → Sync Inbox**. The browser **local checklist remains the working draft**; submitting does not clear or lock the draft.

Each submission stores:

- Tester, device, browser, test date, and session notes
- Every scenario outcome (`pass` / `fail` only — no `not-tested`)
- Release result: **ready** (all pass) or **blocked** (any fail)
- Submitter identity and timestamp

**Recent submitted records** appear in the same Sync Inbox section. Managers refresh the list without leaving the page.

API:

- `GET /api/field/device-verification?limit=12` — recent submissions (manager-only)
- `POST /api/field/device-verification` — finalize current local draft (`confirmation: "FINALIZE_FIELD_DEVICE_VERIFICATION"`)

Prisma model: `FieldDeviceVerificationSubmission` (migration `20260929143000_field_device_verification_submissions`).

## Boundaries (unchanged)

- Does **not** change Field sync, bridge rollout, office rollout, or technician workflows.
- Submitting verification evidence does **not** enable flags or process sync receipts.
- Technicians do not use this API.

## How to file a real-device test

1. Complete the local checklist (51B.2.12) on the test device browser.
2. Mark **Pass** or **Fail** on every scenario; fill tester, device, browser, and date.
3. Click **Submit finalized record** when the banner shows release-ready or blocked.
4. Confirm the entry appears under **Recent submitted records**.
5. Optionally **Copy release record** for tickets; the server copy is the durable audit for Matrix ops.

Apply the migration before submit in each environment:

```bash
npx prisma migrate deploy
npx prisma generate
```

## Rollback

- Stop submitting new records; existing rows remain read-only history.
- Local drafts are unaffected. Dropping the table is only needed if reversing the patch entirely.

## Validation

```bash
npx tsx --test lib/field/device-verification.test.ts lib/field/device-verification-submission.test.ts
```
