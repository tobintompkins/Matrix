# Enterprise Intelligence Platform (Patch 51C.1)

Enterprise Intelligence is the **aggregation layer** branded on top of the existing Executive Command Center. It does **not** invent a second BI system, scoring engine, or database of facts.

## Surface

| Item | Value |
|------|--------|
| Route | `/executive-command-center` (unchanged) |
| UI brand | **Enterprise Intelligence** (ECC subtitle) |
| Permissions | Existing `VIEW_EXECUTIVE_*` family |
| Soft disable | `ENTERPRISE_INTELLIGENCE_51C1=false` hides 51C.1 extensions; core ECC remains |

## What is reused

- AI Operations Center, Decision Engine, Predictive Maintenance
- Service Hub / service calls, Technician roster (`/field`)
- PM, Parts / inventory transactions (`usageByPart`), Customer Portal metrics via org-health
- Organization Health (50B) — bridged into ECC overview and reports
- Matrix Assist — packages executive AI Ask answers (sample or live provider)

## Spec deliverables

| Spec item | Where |
|-----------|--------|
| Fleet Health dashboard | Overview fleet panel + explainable `fleet-health.ts` |
| Executive KPI dashboard | `/executive-command-center/analytics` |
| Predictive maintenance trends | `/executive-command-center/predictive` (+ trend series) |
| Parts consumption analytics | Analytics + report section from inventory CONSUME txns |
| Technician productivity | `/executive-command-center/technicians` |
| Customer reliability scoring | `/executive-command-center/customers` (`customer-reliability.ts`) |
| Report builder | Report Center section checkboxes + saved configs |
| AI insight engine | AI Ask via `insights-qa.ts` + Matrix Assist |
| Export framework | CSV / Excel XML / PDF-text (`export-engine.ts`) |

## Scoring composition

- **Fleet health** — executive rollup in `lib/executive-command-center/fleet-health.ts` (penalties from open/critical calls, PM overdue, predictive risk).
- **Organization Health** — separate panel from `lib/organization-health` (weighted categories). Not merged into the fleet score.
- **Customer reliability** — start at 100; subtract critical/open/at-risk/repeat penalties (`customer-reliability.ts`).

## What is not rebuilt

No `/intelligence` namespace, no duplicate portal/Hub/Parts/predictive evaluate pipeline, no destructive schema.

## Related docs

- [executive-command-center.md](./executive-command-center.md)
- [PATCH_51C1_SAFETY.md](./PATCH_51C1_SAFETY.md)
- [PREDICTIVE_BUSINESS_ANALYTICS.md](./PREDICTIVE_BUSINESS_ANALYTICS.md) (51C.2)
- [ORGANIZATION_HEALTH.md](./ORGANIZATION_HEALTH.md)
