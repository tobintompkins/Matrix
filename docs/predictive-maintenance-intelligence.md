# Predictive Maintenance Intelligence (Patch 51A.3)

Explainable machine-health scoring and maintenance forecasting for Matrix. This is **not** a trained proprietary failure-prediction model — it is a deterministic, versioned scoring engine with optional AI explanations.

## Where it lives

- UI: `/ai-operations/predictive-maintenance`
- APIs: `/api/ai-operations/predictive-maintenance/*`
- Library: `lib/predictive-maintenance/`
- Cron: `POST /api/internal/predictive-maintenance/evaluate`

## Dependencies

Extends (does not replace):

- Patch 45/46 Preventive Maintenance
- Patch 51A.1 AI Operations Center
- Patch 51A.2 AI Automation Framework

## Scoring methodology

1. Assess **data readiness** (model, meters, PM interval, history).
2. Run **risk detectors** (PM overdue, repeat failure, stale meter, usage spike, open emergency, machine down).
3. Apply **deductions/bonuses** from a base of 100.
4. Map score + data quality → risk level (`LOW` / `MODERATE` / `HIGH` / `CRITICAL` / `UNKNOWN`).
5. Calculate **predicted maintenance window** from official due meter + average daily usage (reuses PM Intelligence helpers).
6. Persist a `MachineHealthSnapshot` with factor breakdown JSON and scoring version.

Low data quality reduces confidence and may force `UNKNOWN` risk. AI explanations are optional and never block scoring.

## Automation events

| Event | Meaning |
|-------|---------|
| `predictive.health_score_changed` | Score changed vs prior snapshot |
| `predictive.machine_high_risk` | Risk HIGH |
| `predictive.machine_critical_risk` | Risk CRITICAL |
| `predictive.maintenance_window_opened` | Predicted window within ~14 days |
| `predictive.pm_likely_overdue` | Meter overdue detector |
| `predictive.repeat_failure_detected` | Repeat issue theme |
| `predictive.data_quality_low` | Data quality below threshold |
| `predictive.recommendation_created` | New open recommendation |
| `predictive.alert_created` | New open alert |
| `predictive.reevaluate_requested` | Queued post-mutation re-score |

Templates A–D (Critical Risk, PM Window, Repeat Failure, Low Data Quality) are registered in the automation template library.

## Scheduled job

Set `PREDICTIVE_MAINTENANCE_CRON_SECRET` and call:

```http
POST /api/internal/predictive-maintenance/evaluate
Authorization: Bearer <secret>
```

Processes queued `predictive.reevaluate_requested` events, optionally runs a fleet batch when scheduled evaluation is enabled, then **purges** snapshots/alerts/runs older than `retentionDays`.

## Event-driven re-evaluation

Non-blocking queue after:

- Meter reading create (`/api/pm/meter`)
- Service call create
- Service call resolve/close (`updateServiceCallStatus` + client notify)

## Export

`GET /api/ai-operations/predictive-maintenance/export?dataset=snapshots|alerts|recommendations|runs&format=csv|json&days=90`  
Requires `EXPORT_PREDICTIVE_DATA`.

## Outcome links

Recommendation accept / dismiss / complete writes `PredictiveOutcomeLink` rows for accuracy groundwork (§29).

## Permissions

| Permission | Typical roles |
|------------|----------------|
| `VIEW_PREDICTIVE_MAINTENANCE` | Admin, Manager, Technician |
| `RUN_PREDICTIVE_MAINTENANCE` | Admin, Manager |
| `VIEW_MACHINE_HEALTH` | Admin, Manager, Technician |
| `MANAGE_PREDICTIVE_RECOMMENDATIONS` | Admin, Manager |
| `ACKNOWLEDGE_PREDICTIVE_ALERTS` | Admin, Manager, Technician |
| `MANAGE_PREDICTIVE_SETTINGS` / `MANAGE_PREDICTIVE_SCORING` | Admin |
| `VIEW_PREDICTIVE_HISTORY` | Admin, Manager |
| `EXPORT_PREDICTIVE_DATA` | Admin |

## Safety

- No autonomous PM completion, service-call closure, stock deduction, or customer messaging.
- Service-call creation from predictions remains recommendation + approval-gated.
- Predictions are labeled as predictions in the UI.

## Adding a risk signal

1. Extend `detectRiskFactors` in `risk-detectors.ts`.
2. Map impact in `scoring-engine.ts` if needed.
3. Optionally add recommendation/alert builders.
4. Bump `scoringVersion` via settings/profile so history stays attributable.
5. Add unit tests in `predictive-maintenance.test.ts`.

## Validating against outcomes

`PredictiveOutcomeLink` stores future links between snapshots/recommendations and outcomes (PM completed, SC created, accept/dismiss). Do not claim accuracy until enough reviewed outcomes exist.

## Troubleshooting

| Symptom | Check |
|---------|--------|
| Empty fleet | Run evaluation; ensure `MachinePmState` rows exist |
| Always UNKNOWN | Raise data quality (meters, model, PM interval) |
| Cron 503 | Set `PREDICTIVE_MAINTENANCE_CRON_SECRET` |
| Duplicate alerts | Dedupe uses open `dedupeKey` per machine |
