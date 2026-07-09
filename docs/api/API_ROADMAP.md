# Matrix API Roadmap

**Patch:** PATCH-19 Enterprise Foundation  
**Base URL:** `/api/v1` (version prefix added at implementation)  
**Auth:** Bearer JWT on all routes except public auth endpoints  
**Tenancy:** `organizationId` resolved from token; never accepted from client body on create

---

## Conventions

### Request / response

- JSON request and response bodies
- UUIDs as strings in RFC 4122 format
- Timestamps in ISO 8601 UTC
- Pagination: `?page=1&limit=50` → `{ data, meta: { page, limit, total } }`
- Sorting: `?sort=-createdAt`
- Filtering: query params per resource (e.g. `?status=open&machineId=...`)
- Soft deletes: `DELETE` sets `deletedAt`; `GET` excludes deleted unless `?includeDeleted=true` (admin)

### Standard error shape

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable summary",
    "details": []
  }
}
```

### HTTP status codes

| Code | Usage |
|------|-------|
| 200 | Success with body |
| 201 | Created |
| 204 | Success, no body |
| 400 | Validation error |
| 401 | Unauthenticated |
| 403 | Forbidden (RBAC) |
| 404 | Not found or wrong org |
| 409 | Conflict (duplicate, state) |
| 429 | Rate limited |
| 500 | Server error |

---

## Authentication — `/api/auth`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Email + password → access + refresh tokens |
| POST | `/api/auth/logout` | Invalidate refresh token / session |
| POST | `/api/auth/refresh` | Exchange refresh token for new access token |
| POST | `/api/auth/forgot-password` | Send reset email |
| POST | `/api/auth/reset-password` | Complete password reset |
| GET | `/api/auth/me` | Current user profile + roles + permissions |
| POST | `/api/auth/invite` | Invite user to organization (admin) |
| POST | `/api/auth/accept-invite` | Complete invite registration |

---

## Organizations — `/api/organizations`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/organizations/current` | Current tenant details |
| PATCH | `/api/organizations/current` | Update org name, settings |
| GET | `/api/organizations` | List orgs (super admin only) |
| POST | `/api/organizations` | Create org (super admin) |

---

## Users & roles — `/api/users`, `/api/roles`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users` | List users in org |
| POST | `/api/users` | Create user |
| GET | `/api/users/:id` | User detail |
| PATCH | `/api/users/:id` | Update user |
| DELETE | `/api/users/:id` | Soft-delete user |
| GET | `/api/roles` | List roles |
| POST | `/api/roles` | Create role |
| GET | `/api/roles/:id` | Role detail |
| PATCH | `/api/roles/:id` | Update permissions |
| DELETE | `/api/roles/:id` | Delete role |
| POST | `/api/users/:id/roles` | Assign role |
| DELETE | `/api/users/:id/roles/:roleId` | Remove role |

---

## Customers — `/api/customers`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/customers` | List customers |
| POST | `/api/customers` | Create customer |
| GET | `/api/customers/:id` | Customer detail |
| PATCH | `/api/customers/:id` | Update customer |
| DELETE | `/api/customers/:id` | Soft-delete |
| GET | `/api/customers/:id/locations` | List locations |
| POST | `/api/customers/:id/locations` | Add location |
| GET | `/api/customers/:id/contracts` | List contracts |
| GET | `/api/customers/:id/workorders` | Customer work order history |

### Locations — `/api/locations`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/locations/:id` | Location detail |
| PATCH | `/api/locations/:id` | Update location |
| DELETE | `/api/locations/:id` | Soft-delete |
| GET | `/api/locations/:id/machines` | Machines at site |

---

## Fleet — `/api/fleet`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/fleet` | List all machines (filters: model, status, customer) |
| POST | `/api/fleet` | Register machine |
| GET | `/api/fleet/:id` | Machine digital twin detail |
| PATCH | `/api/fleet/:id` | Update machine |
| DELETE | `/api/fleet/:id` | Decommission / soft-delete |
| GET | `/api/fleet/:id/counters` | Printer counter history |
| GET | `/api/fleet/:id/consumables` | Consumable levels |
| GET | `/api/fleet/:id/alerts` | Active and historical alerts |
| GET | `/api/fleet/:id/parts-installed` | Installed parts |
| POST | `/api/fleet/:id/parts-installed` | Record part installation |
| GET | `/api/fleet/:id/telemetry` | Telemetry stream |
| GET | `/api/fleet/:id/attachments` | Files and photos |
| GET | `/api/fleet/models` | Machine model catalog |
| GET | `/api/fleet/models/:id` | Model detail (GD9630, GL9730, Valezus) |
| GET | `/api/fleet/manufacturers` | Manufacturer list |

---

## Work orders — `/api/workorders`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/workorders` | List work orders |
| POST | `/api/workorders` | Create work order |
| GET | `/api/workorders/:id` | Detail with notes, parts, AI session |
| PATCH | `/api/workorders/:id` | Update status, assignment |
| DELETE | `/api/workorders/:id` | Soft-delete |
| POST | `/api/workorders/:id/assign` | Assign technician |
| POST | `/api/workorders/:id/close` | Close with resolution |
| GET | `/api/workorders/:id/notes` | List notes |
| POST | `/api/workorders/:id/notes` | Add note |
| GET | `/api/workorders/:id/attachments` | List attachments |
| POST | `/api/workorders/:id/attachments` | Upload attachment |
| POST | `/api/workorders/:id/signature` | Capture customer signature |

### Service calls — `/api/servicecalls`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/servicecalls` | List inbound calls |
| POST | `/api/servicecalls` | Log service call |
| GET | `/api/servicecalls/:id` | Detail |
| PATCH | `/api/servicecalls/:id` | Update |
| POST | `/api/servicecalls/:id/convert` | Convert to work order |

---

## Preventive maintenance — `/api/pm`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/pm` | List PM events (scheduled + history) |
| POST | `/api/pm` | Schedule PM |
| GET | `/api/pm/:id` | PM detail |
| PATCH | `/api/pm/:id` | Update / complete PM |
| GET | `/api/pm/templates` | PM kit templates |
| POST | `/api/pm/templates` | Create template |
| GET | `/api/pm/templates/:id` | Template with BOM |
| POST | `/api/pm/request-kit` | Customer/tech PM kit request |
| GET | `/api/pm/overdue` | Overdue PM report |

---

## Inventory — `/api/inventory`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/inventory` | Stock levels (all warehouses) |
| GET | `/api/inventory/:partId` | Part stock across locations |
| POST | `/api/inventory/adjust` | Manual adjustment |
| POST | `/api/inventory/transfer` | Warehouse-to-warehouse transfer |
| POST | `/api/inventory/issue` | Issue to work order |
| POST | `/api/inventory/receive` | Receive from PO |
| GET | `/api/inventory/transactions` | Transaction ledger |
| GET | `/api/inventory/low-stock` | Below reorder point |
| GET | `/api/warehouses` | List warehouses / trucks |
| POST | `/api/warehouses` | Create warehouse |
| GET | `/api/warehouses/:id` | Warehouse detail |
| PATCH | `/api/warehouses/:id` | Update |

---

## Parts — `/api/parts`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/parts` | Search parts catalog |
| POST | `/api/parts` | Create part |
| GET | `/api/parts/:id` | Part detail |
| PATCH | `/api/parts/:id` | Update part |
| DELETE | `/api/parts/:id` | Soft-delete |
| GET | `/api/parts/:id/images` | Part images |
| POST | `/api/parts/:id/images` | Upload image |
| GET | `/api/parts/categories` | Category tree |
| GET | `/api/parts/:id/compatible-models` | Model compatibility |

---

## Orders — `/api/orders`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/orders` | List purchase orders |
| POST | `/api/orders` | Create order |
| GET | `/api/orders/:id` | Order detail with items |
| PATCH | `/api/orders/:id` | Update status |
| POST | `/api/orders/:id/submit` | Submit for approval |
| POST | `/api/orders/:id/approve` | Approve order |
| POST | `/api/orders/:id/cancel` | Cancel order |
| GET | `/api/orders/:id/items` | Line items |
| POST | `/api/orders/:id/items` | Add line item |
| PATCH | `/api/orders/:id/items/:itemId` | Update quantity |
| GET | `/api/orders/:id/shipments` | Shipment tracking |
| POST | `/api/orders/:id/shipments` | Record shipment |
| POST | `/api/orders/:id/receive` | Mark received → inventory |

### Guided diagrams — `/api/diagrams`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/diagrams` | List diagrams by model |
| GET | `/api/diagrams/:id` | Diagram with callouts |
| GET | `/api/diagrams/:id/callouts` | Callout list |
| POST | `/api/diagrams/:id/order` | Add callout parts to cart/order |

---

## Error codes — `/api/errorcodes`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/errorcodes` | Search error codes |
| POST | `/api/errorcodes` | Create (admin) |
| GET | `/api/errorcodes/:id` | Detail with causes/remedies |
| PATCH | `/api/errorcodes/:id` | Update |
| DELETE | `/api/errorcodes/:id` | Soft-delete |
| GET | `/api/errorcodes/lookup/:code` | Lookup by code + model |

---

## Manuals & knowledge — `/api/manuals`, `/api/knowledge`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/manuals` | List manuals |
| POST | `/api/manuals` | Upload manual metadata |
| GET | `/api/manuals/:id` | Manual detail + download URL |
| PATCH | `/api/manuals/:id` | Update revision |
| DELETE | `/api/manuals/:id` | Soft-delete |
| GET | `/api/knowledge` | List KB articles |
| POST | `/api/knowledge` | Create article |
| GET | `/api/knowledge/:id` | Article detail |
| PATCH | `/api/knowledge/:id` | Update / publish |
| DELETE | `/api/knowledge/:id` | Soft-delete |
| GET | `/api/knowledge/search` | Full-text search |

---

## AI — `/api/ai`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/ai/conversations` | List user conversations |
| POST | `/api/ai/conversations` | Start conversation (optional machine/WO context) |
| GET | `/api/ai/conversations/:id` | Conversation + messages |
| POST | `/api/ai/conversations/:id/messages` | Send message, stream response |
| DELETE | `/api/ai/conversations/:id` | Archive conversation |
| POST | `/api/ai/troubleshoot` | Start structured troubleshooting session |
| GET | `/api/ai/sessions/:id` | Session detail |
| PATCH | `/api/ai/sessions/:id` | Resolve / abandon session |
| GET | `/api/ai/recommendations` | Model-scoped recommendations |

---

## RRA integration — `/api/rra`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/rra/devices` | List registered RRA devices |
| POST | `/api/rra/devices` | Register device → machine |
| GET | `/api/rra/devices/:id` | Device status |
| PATCH | `/api/rra/devices/:id` | Update config |
| DELETE | `/api/rra/devices/:id` | Unregister |
| POST | `/api/rra/devices/:id/sync` | Trigger manual sync |
| POST | `/api/rra/webhook` | Inbound telemetry webhook (HMAC verified) |
| GET | `/api/rra/telemetry` | Query telemetry by machine/time range |

---

## Reports — `/api/reports`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/reports/workorders` | WO metrics (MTTR, volume, by status) |
| GET | `/api/reports/fleet` | Fleet health, utilization |
| GET | `/api/reports/pm` | PM compliance |
| GET | `/api/reports/inventory` | Stock valuation, turnover |
| GET | `/api/reports/technicians` | Technician productivity |
| GET | `/api/reports/customers` | Customer SLA summary |
| POST | `/api/reports/export` | Async export job (CSV/PDF) |
| GET | `/api/reports/export/:jobId` | Download export |

---

## Dashboard — `/api/dashboard`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/summary` | Role-aware KPI snapshot |
| GET | `/api/dashboard/alerts` | Critical fleet alerts |
| GET | `/api/dashboard/workqueue` | Open assignments |
| GET | `/api/dashboard/inventory-alerts` | Low stock widgets |
| GET | `/api/dashboard/activity` | Recent audit activity feed |

---

## Technicians — `/api/technicians`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/technicians` | List technicians |
| GET | `/api/technicians/:id` | Profile + certifications |
| PATCH | `/api/technicians/:id` | Update availability, skills |
| GET | `/api/technicians/:id/schedule` | Calendar |
| GET | `/api/technicians/:id/workorders` | Assigned WOs |
| GET | `/api/technicians/:id/inventory` | Truck stock |

---

## Settings — `/api/settings`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/settings` | All org settings (filtered by role) |
| GET | `/api/settings/:key` | Single setting |
| PUT | `/api/settings/:key` | Upsert setting |
| DELETE | `/api/settings/:key` | Remove setting |
| GET | `/api/settings/integrations` | Integration status (masked secrets) |
| PATCH | `/api/settings/integrations/:provider` | Configure RRA, email, etc. |

---

## Platform — `/api/audit`, `/api/notifications`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/audit` | Audit log query (admin/auditor) |
| GET | `/api/audit/:id` | Single audit entry |
| GET | `/api/notifications` | User notifications |
| PATCH | `/api/notifications/:id/read` | Mark read |
| POST | `/api/notifications/read-all` | Mark all read |
| GET | `/api/announcements` | Org announcements |
| POST | `/api/announcements` | Create announcement (admin) |

---

## Contracts & billing (future) — `/api/contracts`, `/api/invoices`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/contracts` | List contracts |
| POST | `/api/contracts` | Create contract |
| GET | `/api/contracts/:id` | Contract detail |
| GET | `/api/invoices` | List invoices |
| POST | `/api/invoices` | Generate invoice |
| GET | `/api/invoices/:id` | Invoice detail |

---

## Training (future) — `/api/training`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/training/courses` | List courses |
| GET | `/api/training/certifications` | User certifications |
| POST | `/api/training/certifications` | Record certification |

---

## Webhooks (future) — `/api/webhooks`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/webhooks` | List subscriptions |
| POST | `/api/webhooks` | Create subscription |
| DELETE | `/api/webhooks/:id` | Remove subscription |

---

## Implementation phases

| Phase | Endpoints | Notes |
|-------|-----------|-------|
| **P1** | auth, customers, fleet, workorders | Core field service |
| **P2** | inventory, parts, orders, pm | Supply chain |
| **P2** | errorcodes, manuals, knowledge, ai | Technician enablement |
| **P3** | rra, reports, dashboard | Operations intelligence |
| **P4** | contracts, invoices, training, webhooks | Enterprise expansion |

---

## Prototype route mapping

Existing Next.js pages remain unchanged in PATCH-19. Future API will back these surfaces:

| Prototype page | Primary API |
|----------------|-------------|
| `/dashboard` | `/api/dashboard` |
| `/customers`, `/add-customer` | `/api/customers` |
| `/fleet`, `/printers`, `/register-printer` | `/api/fleet` |
| `/tickets`, `/new-ticket` | `/api/workorders`, `/api/servicecalls` |
| `/inventory` | `/api/inventory`, `/api/parts` |
| `/order-parts` | `/api/orders`, `/api/diagrams` |
| `/start-pm`, `/request-pm-kit` | `/api/pm` |
| `/ai-technician` | `/api/ai` |
| `/knowledge-base` | `/api/knowledge`, `/api/manuals`, `/api/errorcodes` |

---

*See `docs/security/SECURITY.md` for authentication and authorization requirements.*
