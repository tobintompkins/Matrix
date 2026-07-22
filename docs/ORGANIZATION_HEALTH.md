# Organization Health (Patch 50B)

Live executive operational health inside Matrix Administration.

## Route

`/admin/organization-health` (Matrix uses `/admin`, not `/administration`)

Drill-downs:

- `/admin/organization-health/fleet`
- `/admin/organization-health/service`
- `/admin/organization-health/pm`
- `/admin/organization-health/inventory`
- `/admin/organization-health/technicians`
- `/admin/organization-health/customers`
- `/admin/organization-health/alerts`
- `/admin/organization-health/settings`

## Architecture

- **Score engine:** `lib/organization-health/score.ts` (pure, deterministic, testable)
- **Live metrics:** `lib/organization-health/metrics.ts` — reuses service calls, machines, PM intelligence, inventory, CRM, Approval Center, Customer Portal memberships/parts requests
- **Alerts:** `lib/organization-health/alerts.ts` — rules-based operational risks (not ML)
- **Settings / snapshots:** Prisma `OrganizationHealthSetting`, `OrganizationHealthSnapshot`, `OrganizationHealthAlert`
- **APIs:** `/api/organization-health/*`

Authoritative scores are **never** calculated in the browser.

## Default weights

| Category | Weight |
|----------|--------|
| Fleet | 20% |
| Service | 20% |
| PM | 15% |
| Inventory | 15% |
| Technician | 10% |
| Customer | 10% |
| Financial | 5% |
| Security | 5% |

Disabled categories are excluded and remaining weights normalize to 100%. Missing data is labeled **Not Available / Insufficient Data** and does not automatically score as zero.

## Classifications

- 90–100 Excellent
- 80–89 Healthy
- 70–79 Watch
- 60–69 At Risk
- 0–59 Critical

## Metric dictionary (selected)

### Fleet Availability

**Definition:** Percentage of active fleet machines not DOWN/OFFLINE/RETIRED.

**Formula:** Operational Active Machines / Total Active Machines × 100

### PM Compliance

**Definition:** From PM Intelligence dashboard `pmCompliancePercent`.

### Customer Service Risk

**Definition:** Customers with elevated open critical/aging service work.  
Not labeled “Customer Satisfaction” unless survey data exists.

### Financial Operations

Uses inventory valuation proxies and approval backlog only. Does **not** invent revenue/profit.

## Permissions

`VIEW_ORGANIZATION_HEALTH`, category view permissions, `EXPORT_ORGANIZATION_HEALTH`, `MANAGE_HEALTH_SCORE_WEIGHTS`, alert acknowledge/assign/resolve.

Technicians do not receive organization-wide health access by default.

## Integrations

- **50A Approval Center:** pending/critical/overdue counts + deep link `/admin/approvals`
- **51B Customer Portal:** active users, invitations, parts requests awaiting review; portal service activity counted through existing service-call records (no duplicate ticket DB)

## Snapshots / trends

Manual snapshot via `POST /api/organization-health/snapshot`.  
Automatic daily snapshots are **not** claimed until a scheduler is configured.

## Migration

```bash
npx tsx scripts/apply-orghealth50b-migration.ts
npx prisma generate
```

## Known limitations

- No second charting library — trends render as tables from snapshots
- Financial KPIs limited to supported operational cost proxies
- Data Quality Center / System Logs / Role Simulator remain Patch 50C (not implemented)
- Individual technician productivity requires `VIEW_TECHNICIAN_PRODUCTIVITY`
