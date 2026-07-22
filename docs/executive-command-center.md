# Patch 51A.5 — Executive Command Center

Parts 1–3 operate as **one** Executive Command Center under `/executive-command-center`.

## Part 1 — Foundation
- Route: `/executive-command-center`
- Permission: `VIEW_EXECUTIVE_COMMAND_CENTER`
- APIs: summary, briefing refresh

## Part 2 — Intelligence & Analytics
### Pages
- `/executive-command-center/analytics`
- `/executive-command-center/trends`
- `/executive-command-center/technicians`
- `/executive-command-center/customers`
- `/executive-command-center/predictive`
- `/executive-command-center/insights`
- `/executive-command-center/reports`

### APIs
- `GET /api/executive-command-center/analytics?range=LAST_30`
- `GET /api/executive-command-center/reports?range=LAST_30&format=json|csv`

### Date ranges
`TODAY` · `LAST_7` · `LAST_30` · `LAST_90` · `QTD` · `YTD`

## Part 3 — Reporting, Briefings, Alerts & Automation (Completion)

### Permissions
- `VIEW_EXECUTIVE_COMMAND_CENTER`
- `VIEW_EXECUTIVE_ANALYTICS`
- `VIEW_EXECUTIVE_REPORTS`
- `EXPORT_EXECUTIVE_REPORTS`
- `MANAGE_EXECUTIVE_REPORT_SCHEDULES`
- `MANAGE_EXECUTIVE_ALERTS`
- `USE_EXECUTIVE_AI_INSIGHTS`

### Pages
- `/executive-command-center/briefings` — Daily/Weekly/Monthly + URL filters
- `/executive-command-center/report-center` — period reports, exports, saved configs, history
- `/executive-command-center/alerts` — Action Center (ack/resolve/dismiss)
- `/executive-command-center/ai-insights` — Q&A with observed vs interpretation
- `/executive-command-center/scorecards` — KPI deltas + drill-downs
- `/executive-command-center/comparisons` · `/widgets` · `/schedules`

### APIs
- `GET /api/executive-command-center/briefings`
- `GET|POST /api/executive-command-center/alerts`
- `GET|POST /api/executive-command-center/insights/ask`
- `GET|POST /api/executive-command-center/report-configs` (`?kind=history`)
- `GET /api/executive-command-center/reporting` · `/reporting/export`
- `GET|POST /api/executive-command-center/schedules`
- **Cron:** `POST /api/internal/executive/run-scheduled`  
  Header: `Authorization: Bearer $EXECUTIVE_CRON_SECRET` (or `AUTOMATION_CRON_SECRET`)

### Database
- `executive_report_schedules` (+ timezone, runHour, jobType, filtersJson, lastResult, failureMessage)
- `executive_report_cache`
- `executive_report_configs`
- `executive_report_history`
- `executive_alerts`
- Apply: `npx tsx scripts/apply-ai51a5p3-migration.ts`
- Then: `npx tsx scripts/apply-ai51a5p3-completion-migration.ts`

### Exports
CSV · Excel SpreadsheetML (`.xls`) · PDF-as-text — no new npm packages (matches maintenance export). Not binary XLSX.

### Scheduling note
Schedules are **not** claimed active until `EXECUTIVE_CRON_SECRET` (or `AUTOMATION_CRON_SECRET`) is set and a Railway/cron job hits the internal endpoint. UI “Run due now” works for authenticated managers without cron.

### Performance
Server-side aggregation, ~60s report cache, pagination, rate limits on briefing/export/AI ask.
