# Patch 51B.2.17 — Field Release Evidence Export

## Purpose

Provide a manager-only, read-only JSON evidence record for Field release review. It packages the latest finalized device verification, release-readiness result, latest decision, and recent decision history. The underlying verification submissions and audit records remain unchanged.

## Included

- `GET /api/field/release-evidence` guarded by `VIEW_FIELD_ALL_TECHNICIANS`
- A versioned `field-release-evidence-v1` JSON record
- **Download evidence** on Field → Sync Inbox → Field Release Readiness
- One pure unit test for evidence shape and preserved values

## Use

1. Complete and finalize the device verification checklist.
2. Review Field Release Readiness and record the approved, held, or revoked decision.
3. Select **Download evidence** and attach the JSON file to the release record required by your team.
4. The export is evidence only; it does not turn on the Field bridge or modify sync receipts.

## Validation

```powershell
npx tsx --test lib/field/field-release-evidence.test.ts
npx eslint app/api/field/release-evidence/route.ts app/field/sync-inbox/FieldReleaseReadinessCard.tsx lib/field/field-release-evidence.ts
```

## Rollback

Revert this patch. No database migration or production-data change is included.
