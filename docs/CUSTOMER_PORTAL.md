# Enterprise Customer Portal (Patch 51B)

Secure customer self-service built on the Patch 42 portal foundation.

## Patch status

| Patch | Status |
|-------|--------|
| **51A** (AI Ops → Executive Command Center) | Complete |
| **51B.1** (Customer Portal ↔ Service Hub integration) | Implemented |
| **51B.2** | In progress — Mobile Technician Experience (51B.2.1–51B.2.4: work queue, Field access, signed-in identity, per-user offline storage). Remaining: handler-level authorization, legacy store/`tech-toby` migration, sign-out revocation, real-device verification. |

## Architecture

- **UI routes:** `/portal/*` with preferred aliases (`/portal/service`, `/portal/equipment`, `/portal/preventive-maintenance`, `/portal/meters`, `/portal/parts`, `/portal/contacts`)
- **APIs:** `/api/portal/*` — authenticated, membership-scoped, permission-checked
- **Auth:** Clerk + `CustomerMembership` (Prisma). Development fallback preserves Patch 42 session membership selection.
- **Data:** Reuses CRM customers/sites/assets, service-dispatch tickets, PM intelligence meters, inventory purchase requests, portal documents/announcements
- **Safe output:** `lib/portal/serializers.ts` allowlists fields and blocks internal notes/costs

## Access model

`CustomerMembership` links Clerk users to a CRM customer with:

- Roles: `CUSTOMER_ADMIN`, `CUSTOMER_MANAGER`, `CUSTOMER_USER`, `CUSTOMER_VIEWER` (read-only)
- Status: `INVITED`, `ACTIVE`, `DISABLED` (used for suspended/revoked)
- Optional location/printer access rows

Portal access is **explicit** — internal users are not auto-enrolled.

## Permission keys (51B)

`ACCESS_CUSTOMER_PORTAL`, `VIEW_CUSTOMER_DASHBOARD`, `VIEW_CUSTOMER_EQUIPMENT`, `VIEW_CUSTOMER_SERVICE_CALLS`, `CREATE_CUSTOMER_SERVICE_CALL`, `COMMENT_ON_CUSTOMER_SERVICE_CALL`, `UPLOAD_CUSTOMER_SERVICE_ATTACHMENT`, `VIEW_CUSTOMER_PM`, `SUBMIT_CUSTOMER_METER`, `VIEW_CUSTOMER_METER_HISTORY`, `CREATE_CUSTOMER_PARTS_REQUEST`, `VIEW_CUSTOMER_PARTS_REQUESTS`, `VIEW_CUSTOMER_DOCUMENTS`, `DOWNLOAD_CUSTOMER_DOCUMENTS`, `VIEW_CUSTOMER_CONTACTS`, `MANAGE_CUSTOMER_PORTAL_USERS`, `MANAGE_CUSTOMER_LOCATIONS`, `VIEW_CUSTOMER_NOTIFICATIONS`, `UPDATE_CUSTOMER_PROFILE`

Legacy Patch 42 keys (`VIEW_CUSTOMER_PORTAL`, etc.) remain valid.

## Customer scoping

Every API:

1. Resolves portal actor + active membership
2. Rejects suspended/revoked/pending access
3. Validates machine/location against authorized access
4. Returns generic “not available” for unauthorized IDs (no existence leak)
5. Never trusts client-supplied customer/org/requester IDs

## Customer-visible vs internal notes

Service activity uses `visibleToCustomer` updates only. Portal serializers never include `internalNotes`, labor/parts cost, margins, or employee-only fields.

## Workflows

### Service requests

Created through existing `createDispatchTicket` with `source: CUSTOMER_PORTAL`.

### Meter submissions

`enterMeterCount` with source `Customer Submission`. Lower/suspicious readings require override review.

### Parts requests

Creates inventory `PurchaseRequest` (no vendor/cost control by customer) + `PortalPartsRequest` row for customer-safe status.

### PM schedule changes

Creates `CustomerChangeRequest` and optionally an Approval Center `PM_SCHEDULE_CHANGE` request. **Does not mutate** the live PM schedule.

### Contact updates

Submitted as review requests — do not overwrite CRM contacts immediately.

## Configuration

Admin settings via `GET/PATCH /api/portal/settings` and the **Portal settings** form on `/admin/portal` (`ADMINISTER_CUSTOMER_PORTAL`):

Portal enabled, allow service/meter/parts/PM-change/invites, attachment limits, support contact, terms/privacy URLs.

## Onboarding

First-time users can complete `/portal/onboarding` (welcome → contact → notifications → locations → equipment → terms). State is stored in `PortalOnboardingState`. Optional profile fields never permanently block access.

## Attachments

`POST /api/portal/service-requests/:id/attachments` accepts multipart uploads (MIME/size validated). Files are stored under `data/portal-uploads` and served only through authorized download routes. Internal-only attachments are never listed.

## Administrator guide

1. Enable portal settings (`/admin/portal` or `/api/portal/settings`)
2. Ensure CRM customer exists
3. Seed/create `CustomerMembership` with `CUSTOMER_ADMIN`
4. Invite additional users from `/portal/users` (Customer Admin)
5. Assign location/printer access as needed
6. Suspend/revoke via portal users API
7. Post customer-visible ticket updates from internal dispatch (visibleToCustomer)
8. Upload customer-visible documents (`PortalDocument.visibleToCustomer = true`)

## Security controls

- Clerk authentication + membership status
- Organization/customer/location/machine isolation
- Permission checks on every API
- Allowlisted serializers
- Invitation roles limited to `CUSTOMER_*`
- Profile PATCH blocks role/org/permission fields
- Attachment MIME/size validation (existing portal security helpers)
- Audit events for login, create, meter, parts, PM change, downloads, invites, suspend/revoke

## Known limitations

- Catalog document downloads authorize and audit access; binary delivery depends on document source having stored bytes
- Email invitation delivery depends on Clerk/email configuration (adapter safe when unset)
- SMS not delivered
- Some list pages still hydrate from the Patch 42 client store for demo/dev; `/api/portal/*` is the secure source of truth for scoped access

## Patch 51B.1 — Service Hub integration

Connects the Customer Portal to the same service-call records used by Service Hub technicians. Integration only — does not rebuild portal, PM, or parts systems.

### Spec alignment (IMPLEMENTATION_SPEC)
- Canonical ownership: CRM machines/sites, service-dispatch tickets, existing PM/parts/notifications
- Customer-safe allowlist serializers (`lib/portal/serializers.ts`)
- Central typed status map: `CustomerServiceStatus` + `mapInternalStatusToCustomer` (`lib/portal/status-map.ts`)
- Customer-visible chronological timeline (`buildCustomerVisibleTimeline`)
- Matrix Assist audience: `MatrixAssistAudience = "internal" | "technician" | "customer"`
- Cross-customer isolation enforced on every portal ticket query (negative tests in `portal51b1.test.ts`)

### Added / enhanced
- Shared customer context: `lib/portal/customer-context.ts` + `GET /api/portal/context`
- Machine profile: `lib/portal/machine-profile.ts` (PM, history, docs, Request Service / Parts)
- Notification center with read/unread: `/portal/notifications` + `GET|PATCH /api/portal/notifications`
- Matrix Assist customer mode: `lib/matrix-assist/customer-mode.ts` + `POST /api/portal/assist`
- Service Hub: Portal Submitted badge, customer status preview, visibility markers on ticket updates, customer-visible update composer; portal attention item on Service Hub dashboard
- Parts: portal-safe deep link into Parts Order Builder (`?portal=1`)

### Customer-visible updates (staff)
`postCustomerVisibleUpdate()` in service-dispatch — audited, visible in portal timeline only when `visibleToCustomer` is true.

### Next
**51B.2 — Mobile Technician Experience (in progress)**  
Parts 51B.2.1–51B.2.3 added the Field next-job card, a Field entry gate on Clerk `matrixRole` + `VIEW_FIELD` (no development SUPER_ADMIN fallback), and signed-in Field identity (Clerk user ID as owner; `technicianName` or full name for assignment matching). It is not a complete mobile release. Remaining gates: user-scoped offline storage, handler-level authorization, legacy `tech-toby` migration, sign-out/offline revocation, and real-device verification of offline download/reopen, interrupted sync, conflicts, notes/photos/signatures, and completion. No Onyx in this item. The entry gate does not authorize cached/offline Field pages. Name matching is not authorization.

## Migration

```bash
npx tsx scripts/apply-portal51b-migration.ts
npx prisma generate
```
