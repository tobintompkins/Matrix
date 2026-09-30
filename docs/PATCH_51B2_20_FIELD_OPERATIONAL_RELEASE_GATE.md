# Patch 51B.2.20 — Field Operational Release Gate

## Purpose

Give managers one advisory ready/blocked result before a controlled Field release. The gate combines the latest finalized device verification, the latest audited release decision, and receipt queue health. It does not change a rollout flag or release state.

## Gate requirements

- Latest verification is release-ready
- Latest decision is approved and references that verification
- No receipts waiting to process
- No rejected receipts needing review

## Included

- `GET /api/field/operational-release-gate` guarded by `VIEW_FIELD_ALL_TECHNICIANS`
- A read-only **Field Operational Release Gate** card on Sync Inbox
- Focused tests for ready and blocked rules

## Validation

```powershell
npx tsx --test lib/field/field-operational-release-gate.test.ts
npx eslint app/api/field/operational-release-gate/route.ts app/field/sync-inbox/FieldOperationalReleaseGateCard.tsx lib/field/field-operational-release-gate.ts lib/field/field-operational-release-gate-service.ts
```

## Rollback

Revert this patch. The gate is read-only and does not alter receipts, release decisions, work orders, or bridge configuration.
