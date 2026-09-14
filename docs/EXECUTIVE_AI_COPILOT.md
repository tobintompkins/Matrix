# Executive AI Copilot (Patch 51C.3)

Extends the existing Enterprise Intelligence **AI Ask** surface and Matrix Assist packaging. It is **not** a second AI assistant product.

## Surface

- UI: `/executive-command-center/ai-insights` (nav: **AI Copilot**)
- Ask API: `POST /api/executive-command-center/insights/ask` (`USE_EXECUTIVE_AI_INSIGHTS`)
- Bundle API: `GET /api/executive-command-center/copilot?view=widgets|daily|weekly|decisions|bundle`
- Flag: `EXECUTIVE_AI_COPILOT_51C3` (default `true`)

## Guarantees

- Answers use **only Matrix data** (ECC period report, alerts, inventory, PM, predictive, PBA).
- Always returns **confidence**, **supporting records**, **related reports**, **assumptions**.
- `fabricated: false` — unavailable data is stated explicitly.
- Decision support recommendations are **`executable: false`** — never auto-order, auto-PM, auto-assign, or mutate CRM.
- Customers / portal APIs never receive executive Copilot payloads.

## Reuses

| Module | Role |
|--------|------|
| Matrix Assist | Optional wording packaging via `draftServiceNotes` |
| ECC reporting / widgets / briefings | Evidence + daily/weekly narratives |
| Predictive Business Analytics | Forecast questions |
| Inventory / PM / service calls | Operational facts |
| Existing ECC permissions | Executive / manager access |

## Soft-disable

```env
EXECUTIVE_AI_COPILOT_51C3=false
```
