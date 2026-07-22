# Patch 51A.4 — Enterprise Decision Engine

## Purpose

Ranked, explainable operational recommendations with human approval. Reuses AI Operations (51A.1), Automations (51A.2), and Predictive Maintenance (51A.3). Does **not** duplicate service, PM, inventory, customer, technician, notification, or audit systems.

## Scoring (deterministic)

```
overall =
  35% risk +
  25% urgency +
  20% business impact +
  10% SLA impact +
  10% confidence
```

Priority thresholds (`lib/decision-engine/types.ts`):

| Priority | Overall |
|----------|---------|
| CRITICAL | ≥ 80 |
| HIGH | ≥ 65 |
| MEDIUM | ≥ 45 |
| LOW | ≥ 25 |
| INFORMATIONAL | < 25 |

AI explanations are templates/sample-mode only and **never** change scores.

## High-impact policy

Approving a recommendation records intent and audit history. It does **not** auto:

- adjust inventory / create POs
- send customer communications
- close service calls
- retire/replace machines
- change user roles

Follow through in existing Matrix modules after approval.

## Routes

- UI: `/ai-operations/decisions`, `/ai-operations/decisions/[id]`
- API: `GET/POST /api/ai-operations/decisions*`, generate, summary, actions

## Apply migration (SQLite)

```bash
npx tsx scripts/apply-ai51a4-migration.ts
npx prisma generate
```

## Permissions

`VIEW_DECISION_CENTER`, `VIEW_ALL_DECISIONS`, `CREATE_DECISION_RECOMMENDATION`, `REVIEW_DECISIONS`, `APPROVE_DECISIONS`, `ASSIGN_DECISIONS`, `COMPLETE_DECISIONS`, `MANAGE_DECISION_RULES`, `VIEW_DECISION_COSTS`, `RUN_DECISION_ENGINE` (granted to ADMIN/SUPER_ADMIN via AI center set; managers get review/run subset).
