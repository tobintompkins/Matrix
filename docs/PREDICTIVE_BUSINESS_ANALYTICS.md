# Predictive Business Analytics (Patch 51C.2)

Extends **Enterprise Intelligence** (51C.1 / ECC) with explainable **business** forecasts. Does **not** rebuild predictive maintenance machine scoring (`/ai-operations/predictive-maintenance` or ECC `/predictive`).

## Surface

| Item | Value |
|------|--------|
| UI | `/executive-command-center/predictive-analytics` |
| APIs | `GET /api/executive-command-center/predictive-analytics`, `POST .../scenarios`, `POST .../risk-override` |
| Permissions | `VIEW_EXECUTIVE_COMMAND_CENTER` / `VIEW_EXECUTIVE_ANALYTICS`; overrides need `MANAGE_EXECUTIVE_ALERTS` |
| Flag | `PREDICTIVE_BUSINESS_ANALYTICS_51C2` (default `true`) |

## Forecast result fields (official 02_IMPLEMENTATION_SPEC)

Each `ForecastMeta` includes: metric, scope, horizon, generatedAt, sourceDataCutoff, recordCount, dataSufficient, method + methodVersion (`pba-baseline-v1`), predicted series points, confidence bounds only when supportable, assumptions, warnings.

## Preferred baseline methods

| Method | Id |
|--------|-----|
| Moving average | `moving_average` |
| Weighted moving average | `weighted_moving_average` |
| Linear trend | `linear_trend` |
| Seasonal comparison (enough history) | `seasonal_comparison` |
| Meter-rate projection (PM) | `meter_rate` |
| Consumption-rate projection (parts) | `consumption_rate` |

## Required modules

Service Demand · PM Workload · Parts Demand · Machine Reliability · Customer Service Health (internal) · Technician Capacity · Scenario Planning · Forecast Accuracy · Predictive Alerts · Predictive Reports · AI Forecast Explanations · Data Quality

## Safety

Scenarios remain separate from production (`mutatesLiveRecords: false`, `requiresUserConfirmation: true`). Recommendations require user confirmation. Customer Service Health scores are executive-only and must not enter customer-facing/portal APIs.

## Reuse map

Service calls, inventory CONSUME/balances, MachinePmState, health snapshots, technician roster, 51C.1 customer reliability, Matrix Assist packaging, report builder section `predictiveBusiness`.

## Deferred

- Persisted forecast snapshot history (Prisma) for richer backtesting
- Durable override store across process restarts
- Customer-scoped portal views of these forecasts (executive-only today)
