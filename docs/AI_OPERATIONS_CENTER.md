# AI Operations Center — Patch 51A.1

Extends a single AI Operations Center across Parts 1–3. Does **not** create a second AI system or modify operational records.

## Routes

- Primary dashboard: `/ai-operations`
- Assistant: `/ai-operations/assistant` · `/ai-operations/assistant/[conversationId]`
- `/ai` redirects to `/ai-operations`
- Nav: Administration → AI Operations Center

## Permissions

**Part 1/2:** `VIEW_AI_CENTER`, `MANAGE_AI`, `AI_ADMIN`, `VIEW_AI_OPERATIONS`, `VIEW_AI_INSIGHTS`, review/assign/resolve/dismiss/archive, `RUN_AI_ANALYSIS`, `VIEW_AI_HEALTH`, `MANAGE_AI_OPERATIONS`

**Part 3:** `VIEW_AI_ASSISTANT`, `USE_AI_ASSISTANT`, `VIEW_AI_CONVERSATIONS`, `MANAGE_OWN_AI_CONVERSATIONS`, `VIEW_ALL_AI_CONVERSATIONS`, `DELETE_AI_CONVERSATIONS`, `VIEW_AI_ASSISTANT_SOURCES`, `EXPORT_AI_ASSISTANT_RESULTS`, `MANAGE_AI_ASSISTANT`

ADMIN / SUPER_ADMIN receive these via `ALL_PERMISSIONS`.

## Schema (additive AiOps*)

| Part | Models / tables |
|------|------------------|
| 1 | sessions, logs, predictions, notifications, learning, metrics, recommendations |
| 2 | `ai_analysis_runs`, `ai_insights`, `ai_insight_events` |
| 3 | `ai_assistant_conversations`, `ai_assistant_messages`, `ai_assistant_sources`, `ai_assistant_feedback` |

Migrations: `20260714210000_ai_center_51a1`, `20260714220000_ai_ops_dashboard_51a1p2`, `20260714230000_ai_assistant_51a1p3`

## Part 3 Assistant

Deterministic permission-aware NL search (no arbitrary SQL; no external LLM required).

## Part 51A.2 Automations

Route: `/ai-operations/automations` — see `docs/ai-automation-framework.md`

## Safety

- Insights, answers, and automations are advisory
- AI never deletes/closes/adjusts operational records autonomously
- High-impact automation actions require approval
- Audit via `writeAdminAudit`
