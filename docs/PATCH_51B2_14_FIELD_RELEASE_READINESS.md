# Patch 51B.2.14 — Field Release Readiness dashboard

## What this adds

Managers with Sync Inbox access see a **Field Release Readiness** card at the top of **Field → Sync Inbox**. It is **read-only** and derives status from the **latest finalized** `FieldDeviceVerificationSubmission` (51B.2.13).

| State | Meaning |
| --- | --- |
| **Incomplete** | No finalized server verification exists yet |
| **Ready** | Latest submission is release-ready (all scenarios passed) |
| **Blocked** | Latest submission includes one or more failed scenarios |

The card shows tester, device, test date, submission time, failed scenario labels (when blocked), and a link to the local **device verification checklist** (`#field-device-verification`).

API: `GET /api/field/release-readiness` (manager-only; includes release decision history per 51B.2.15).

Audited **approve / hold / revoke** decisions: [PATCH_51B2_15_FIELD_RELEASE_DECISION.md](./PATCH_51B2_15_FIELD_RELEASE_DECISION.md).

## Boundaries (unchanged)

- Does not modify Field sync, bridge rollout, office rollout, or stored verification submissions.
- Does not submit or edit checklist data; managers use the existing checklist + submit flow (51B.2.12 / 51B.2.13).

## Validation

```bash
npx tsx --test lib/field/field-release-readiness.test.ts
```

After submitting a finalized record, refresh the readiness card and confirm state, metadata, and failed scenarios match the submission.
