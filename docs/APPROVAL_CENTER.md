# Enterprise Approval Center (Patch 50A)

Centralized, reusable approval workflow engine for Matrix modules.

## Architecture

- **Route:** `/admin/approvals` (Matrix Administration convention)
- **APIs:** `/api/approvals/*`, `/api/approval-rules/*`
- **Services:** `lib/approvals/` — request CRUD, rule matching, workflow progression, HMAC decision verification, metrics, notifications
- **Persistence:** Prisma models `ApprovalRequest`, `ApprovalStep`, `ApprovalDecision`, `ApprovalComment`, `ApprovalAssignment`, `ApprovalRule`, `ApprovalAttachment`, `ApprovalRequestSequence`
- **Auth:** Existing Clerk + Matrix permission keys (no separate user/role system)
- **Audit:** `writeAdminAudit` in `lib/admin/repository.ts`
- **Notifications:** Existing in-app `pushNotification` / `createEventNotification` (email adapter is a no-op until SMTP/provider is configured)

## Lifecycle

1. Draft created (`DRAFT`)
2. Submitted → matching rule selected → steps created → `PENDING`
3. Reviewer actions: approve / reject / return / escalate / assign / delegate
4. Multi-step approve advances `WAITING` → `ACTIVE` until final step
5. Final approve → `COMPLETED`; reject → `REJECTED`; cancel → `CANCELLED`
6. Closed requests may be `ARCHIVED` (not deleted)

Statuses: `DRAFT`, `PENDING`, `IN_REVIEW`, `RETURNED_FOR_REVISION`, `APPROVED`, `REJECTED`, `CANCELLED`, `ESCALATED`, `COMPLETED`, `ARCHIVED`.

## Rule format

```json
{
  "conditions": {
    "requestedAmount": { "operator": "GREATER_THAN", "value": 2000 }
  },
  "workflow": {
    "steps": [
      {
        "stepNumber": 1,
        "name": "Service Manager Review",
        "requiredPermission": "APPROVE_REQUEST",
        "dueInHours": 24
      }
    ]
  }
}
```

Operators: `EQUALS`, `NOT_EQUALS`, `GREATER_THAN`, `GREATER_THAN_OR_EQUAL`, `LESS_THAN`, `LESS_THAN_OR_EQUAL`, `IN`, `NOT_IN`, `CONTAINS`, `IS_EMPTY`, `IS_NOT_EMPTY`.

Rules are evaluated server-side only. Highest priority (lowest number) matching active rule wins. If none match, a safe default Administrator Review workflow is used — requests are never auto-approved.

## Permission keys

`VIEW_APPROVAL_CENTER`, `VIEW_ALL_APPROVALS`, `VIEW_ASSIGNED_APPROVALS`, `CREATE_APPROVAL_REQUEST`, `APPROVE_REQUEST`, `REJECT_REQUEST`, `RETURN_APPROVAL_FOR_REVISION`, `ESCALATE_APPROVAL`, `ASSIGN_APPROVAL_REVIEWER`, `DELEGATE_APPROVAL`, `CANCEL_APPROVAL`, `COMMENT_ON_APPROVAL`, `MANAGE_APPROVAL_RULES`, `EXPORT_APPROVALS`, `ARCHIVE_APPROVALS`, `VIEW_APPROVAL_AUDIT`

## API routes

| Method | Path | Purpose |
|--------|------|---------|
| GET/POST | `/api/approvals` | List / create |
| GET | `/api/approvals/metrics` | Live dashboard metrics |
| GET/PATCH | `/api/approvals/:id` | Detail / draft update (no status mass-assignment) |
| POST | `/api/approvals/:id/submit` | Submit / resubmit |
| POST | `/api/approvals/:id/approve` | Approve active step |
| POST | `/api/approvals/:id/reject` | Reject (reason required) |
| POST | `/api/approvals/:id/return` | Return for revision |
| POST | `/api/approvals/:id/escalate` | Escalate |
| POST | `/api/approvals/:id/assign` | Assign reviewer |
| POST | `/api/approvals/:id/delegate` | Delegate |
| POST | `/api/approvals/:id/cancel` | Cancel |
| POST | `/api/approvals/:id/archive` | Archive |
| GET/POST | `/api/approvals/:id/comments` | Comments |
| POST | `/api/approvals/:id/comments/:commentId/replies` | Replies |
| GET/POST | `/api/approval-rules` | List / create rules |
| PATCH | `/api/approval-rules/:id` | Update rule |
| POST | `/api/approval-rules/:id/activate` | Activate |
| POST | `/api/approval-rules/:id/deactivate` | Deactivate |

## Module integration example

Other Matrix modules should call the service — never write approval tables directly:

```ts
import { submitApprovalFromModule } from "@/lib/approvals";
import type { AdminActor } from "@/lib/admin/auth";

export async function requestPartsOrderApproval(
  actor: AdminActor,
  partsOrder: { id: string; total: number; title: string },
) {
  return submitApprovalFromModule(actor, {
    title: partsOrder.title,
    approvalType: "PARTS_ORDER",
    sourceModule: "parts",
    sourceRecordId: partsOrder.id,
    partsOrderId: partsOrder.id,
    requestedAmount: partsOrder.total,
    currency: "USD",
    priority: partsOrder.total > 5000 ? "HIGH" : "NORMAL",
    businessJustification: "Parts required for open service work",
  });
}
```

## Registering a future approval type

```ts
import { registerApprovalType } from "@/lib/approvals";

registerApprovalType({
  type: "VENDOR_CREDIT",
  label: "Vendor Credit",
  sourceModule: "finance",
  fields: ["requestedAmount", "currency", "businessJustification"],
});
```

## Decision signatures

Approve/reject (and related) decisions store an HMAC-SHA256 `signatureHash` derived from request ID, step ID, decision, actor, role, timestamp, organization ID, and `APPROVAL_SIGNATURE_SECRET` (falls back to Clerk secret / DB URL in development). This is a **digital decision verification record**, not a handwritten signature. Decision rows are immutable through normal APIs.

## Request numbering

Server-generated, org-scoped: `APR-2026-000001` via `ApprovalRequestSequence` (transactional increment — not row counting).

## SLA / overdue

Waiting time and overdue are computed from server timestamps on read. `processOverdueEscalations()` is documented for a future worker; Patch 50A does not run automatic background escalation.

## Seeded rules (idempotent)

- Parts Order over $2,000 → Service Manager → Executive
- Expense over $500 → Finance
- Critical Emergency Request → Executive
- Inventory Adjustment over 20% → Inventory Manager → Administrator

## Known limitations

- No background job scheduler for auto-escalation
- Email delivery reserved behind adapter (in-app notifications always used when prefs allow)
- Attachment upload UI is minimal (relationship table exists; wire to existing file storage when available)
- Bulk approve/reject not exposed in UI (archive selected is available; each decision must remain individually authorized)
- Organization Health is implemented in Patch 50B (`docs/ORGANIZATION_HEALTH.md`)
- Data Quality / System Logs / Role Simulator remain out of scope for 50A/50B (Patch 50C)

## Migration

```bash
npx tsx scripts/apply-approval50a-migration.ts
npx prisma generate
```
