# MATRIX Master Blueprint

**Patch:** PATCH-19 Enterprise Foundation  
**Status:** Architectural specification (documentation only — no UI changes)  
**Audience:** Engineering, product, operations, security, and compliance stakeholders

---

## Vision

Matrix is the enterprise field-service and digital-twin platform for RISO print fleet operations. It unifies customer management, fleet visibility, technician workflows, parts and inventory, preventive maintenance, AI-assisted troubleshooting, and remote monitoring into a single multi-tenant system.

**Strategic goals:**

- Replace prototype workflows with a scalable, auditable, API-first platform
- Support single-org desktop/offline deployments and multi-org cloud (Railway / PostgreSQL)
- Preserve all existing prototype features while layering enterprise tenancy, RBAC, and compliance
- Enable technicians, dispatchers, inventory clerks, and customers to work from web, mobile, and portal surfaces
- Integrate RRA telemetry, error codes, manuals, and guided diagram ordering for GD9630, GL9730, and Valezus device families

**Non-goals for PATCH-19:** UI refactors, database migrations, or API implementation. This patch establishes the enterprise foundation in documentation only.

---

## Architecture

### High-level system

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Client Surfaces                                  │
│  Admin Web │ Technician Portal │ Customer Portal │ Mobile App │ API SDK │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    Matrix API Layer (REST / future GraphQL)              │
│  Auth │ RBAC │ Rate Limit │ Audit │ Multi-tenant context (organizationId)│
└─────────────────────────────────────────────────────────────────────────┘
                                    │
          ┌─────────────────────────┼─────────────────────────┐
          ▼                         ▼                         ▼
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│  Core Services   │    │  AI Services     │    │  Integration     │
│  Fleet, WO, PM   │    │  Conversations   │    │  RRA, Valezus    │
│  Inventory, PO   │    │  Recommendations │    │  GD9630 / GL9730 │
└──────────────────┘    └──────────────────┘    └──────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│              PostgreSQL (production) / SQLite (local prototype)          │
│  UUID PKs │ Soft delete │ Audit trail │ Row-level org isolation          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Technology stack (current → target)

| Layer | Current (prototype) | Enterprise target |
|-------|---------------------|-------------------|
| Frontend | Next.js App Router | Next.js + dedicated portals |
| API | Server actions / inline routes | Versioned REST under `/api/v1` |
| ORM | Prisma | Prisma with PostgreSQL |
| IDs | `cuid()` strings | UUID v4 |
| Tenancy | Partial `organizationId` | Full row-level isolation |
| Auth | Placeholder | JWT + refresh tokens, SSO-ready |

### Cross-cutting concerns

Every domain entity carries standard audit and tenancy columns: `id` (UUID), `organizationId`, `createdAt`, `updatedAt`, `deletedAt`, `createdBy`, `updatedBy`. See `docs/database/ENTITY_RELATIONSHIP.md`.

### Deployment modes

1. **Desktop / offline-first** — SQLite, sync queue, deferred cloud push
2. **Single-tenant cloud** — One organization, full feature set
3. **Multi-tenant SaaS** — Organization-per-customer with strict data isolation

---

## User Roles

| Role | Description | Primary surfaces |
|------|-------------|------------------|
| **Super Admin** | Platform operator across organizations | Admin, settings, audit |
| **Org Admin** | Full control within one organization | Admin, users, roles, billing |
| **Dispatcher** | Schedules technicians, assigns work | Dashboard, work orders, fleet |
| **Technician** | Field service execution | Technician portal, mobile |
| **Inventory Clerk** | Parts, warehouses, purchase orders | Inventory, orders |
| **Sales / Account Manager** | Customer relationships, contracts | Customers, reporting |
| **Customer User** | Self-service portal access | Customer portal |
| **Read-only Auditor** | Compliance and reporting | Reports, audit logs |
| **AI Operator** | Manages knowledge base and AI tuning | Knowledge base, manuals |

Roles are organization-scoped. A user may hold multiple roles via `UserRole` join records.

---

## Permission Matrix

Permissions use dot-notation keys stored on `Role.permissions` (JSON array). `*` grants all within org scope.

| Permission key | Super Admin | Org Admin | Dispatcher | Technician | Inventory | Customer | Auditor |
|----------------|:-----------:|:---------:|:----------:|:----------:|:---------:|:--------:|:-------:|
| `org.read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `org.manage` | ✓ | ✓ | — | — | — | — | — |
| `users.manage` | ✓ | ✓ | — | — | — | — | — |
| `roles.manage` | ✓ | ✓ | — | — | — | — | — |
| `customers.read` | ✓ | ✓ | ✓ | ✓ | — | own | ✓ |
| `customers.write` | ✓ | ✓ | ✓ | — | — | — | — |
| `fleet.read` | ✓ | ✓ | ✓ | ✓ | ✓ | own | ✓ |
| `fleet.write` | ✓ | ✓ | ✓ | ✓ | — | — | — |
| `workorders.read` | ✓ | ✓ | ✓ | assigned | — | own | ✓ |
| `workorders.write` | ✓ | ✓ | ✓ | assigned | — | — | — |
| `inventory.read` | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ |
| `inventory.write` | ✓ | ✓ | — | — | ✓ | — | — |
| `orders.read` | ✓ | ✓ | ✓ | ✓ | ✓ | own | ✓ |
| `orders.write` | ✓ | ✓ | ✓ | ✓ | ✓ | — | — |
| `pm.read` | ✓ | ✓ | ✓ | ✓ | — | — | ✓ |
| `pm.write` | ✓ | ✓ | ✓ | ✓ | — | — | — |
| `ai.use` | ✓ | ✓ | ✓ | ✓ | — | — | — |
| `knowledge.read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `knowledge.write` | ✓ | ✓ | — | — | — | — | — |
| `reports.read` | ✓ | ✓ | ✓ | — | — | limited | ✓ |
| `audit.read` | ✓ | ✓ | — | — | — | — | ✓ |
| `settings.manage` | ✓ | ✓ | — | — | — | — | — |

---

## Modules

| Module | Route (prototype) | Enterprise API prefix | Description |
|--------|-------------------|----------------------|-------------|
| Service Hub (Dashboard) | `/dashboard` (alias `/service-hub`) | `/api/dashboard` | KPIs, alerts, workload — presented to users as **Service Hub** |
| Customers | `/customers`, `/add-customer` | `/api/customers` | Accounts, locations, contacts |
| Fleet | `/fleet`, `/printers`, `/register-printer` | `/api/fleet` | Machines, models, telemetry |
| Tickets / Work Orders | `/tickets`, `/new-ticket` | `/api/workorders` | Service lifecycle |
| Inventory | `/inventory` | `/api/inventory` | Stock, warehouses, transactions |
| Parts Ordering | `/order-parts` | `/api/orders` | POs, shipments, diagram orders |
| PM | `/start-pm`, `/request-pm-kit` | `/api/pm` | Schedules, kits, history |
| Matrix Assist | `/ai-technician` | `/api/matrix-assist` | Advisory diagnostics, history summary, note drafts (Patch 48) |
| Administration Center | `/admin` | `/api/admin` | Users, roles, config, features, audit, security (Patch 49A) |
| Knowledge Base | `/knowledge-base` | `/api/manuals`, `/api/errorcodes` | Articles, manuals, error library |
| Settings | — | `/api/settings` | Org and user preferences |
| Auth | — | `/api/auth` | Login, sessions, tokens |
| RRA | — | `/api/rra` | Remote monitoring bridge |
| Reports | — | `/api/reports` | Exports, analytics |

---

## AI Features

- **Matrix Assist** — Context-aware advisory diagnostics tied to service call / machine (human approval required)
- **Structured troubleshooting sessions** — `AITroubleshootingSession` links conversation → machine → work order
- **Recommendations** — Model-specific suggested checks with confidence scores
- **Knowledge grounding** — Error codes, manuals, service bulletins, and KB articles as retrieval context
- **Future:** Vision on diagram callouts, automatic work-order draft from conversation, predictive PM

Guardrails: org-scoped data only, audit log on AI actions, PII redaction in logs, human-in-the-loop for parts orders and WO closure.

---

## Multi Organization Support

- `Organization` is the tenancy root; every business table includes `organizationId`
- Users belong to exactly one organization (future: multi-org membership via join table)
- Roles and permissions are organization-scoped
- Customers, fleet, inventory, and work orders are never shared across orgs without explicit federation (future)
- Settings JSON on `Organization` holds branding, timezone, feature flags, and integration credentials (encrypted at rest)
- Super Admin operates above tenant boundary for platform management only

---

## Fleet Management

Digital twin for each physical machine (`Machines` / prototype `Printer`):

- Registration by serial, asset ID, model, and customer location
- Status lifecycle: active, warning, fault, offline, decommissioned
- Meter history and printer counters from manual entry or RRA
- Alerts and error code correlation
- Installed parts tracking and firmware version
- Attachments, photos, and customer signatures per asset

---

## Inventory

- Multi-warehouse and truck/van stock locations
- `Inventory` balances per part per warehouse
- `InventoryTransactions` for receive, issue, transfer, adjust, return
- Reorder points and low-stock notifications
- Part compatibility by machine model
- Integration with work orders and PM kit consumption

---

## Parts Ordering

- Internal part requests linked to tickets and machines
- Purchase orders with approval workflow
- Order line items, shipments, and receiving
- **Guided diagram ordering** — Interactive exploded diagrams with callouts mapped to `Parts`
- Customer-visible order status in customer portal (future)

---

## Guided Diagram Ordering

- `PartDiagrams` store vector or raster exploded views per model
- `DiagramCallouts` map hotspot regions to part numbers
- Technician or customer selects callout → adds to cart / order
- Supports GD9630, GL9730, Valezus diagram sets
- Versioning when manufacturers update parts layouts

---

## Work Orders

Enterprise evolution of prototype `ServiceTicket`:

- Numbered work orders with priority, job type, SLA timers
- Assignment, dispatch, and technician mobile execution
- Notes, attachments, photos, signatures
- Parts consumed and orders spawned from WO context
- AI troubleshooting session linkage
- Status: draft → open → in progress → waiting parts → completed → closed

---

## Preventive Maintenance

- PM templates per machine model (`PMKitTemplate` / enterprise `PreventiveMaintenance`)
- Scheduled PM by calendar, meter, or contract
- PM kit BOM and inventory reservation
- PM history with meter-at-service and technician attribution
- Customer PM kit requests via portal (`/request-pm-kit`)

---

## RRA Integration

Remote RISO Assistant bridge:

- `RRADevices` registry mapping RRA endpoints to machines
- `Telemetry` ingestion: counters, alerts, consumable levels
- Polling or webhook push (deployment-dependent)
- Correlation with `ErrorCodes` and automatic ticket creation (configurable)
- Offline buffer and sync for field laptops

---

## Valezus

Valezus production printer family support:

- Dedicated `MachineModels` catalog entries and capabilities JSON
- Model-specific error codes, manuals, diagrams, and PM kits
- Firmware release tracking per Valezus SKU
- AI context packs tuned for Valezus subsystems

---

## GD9630

High-speed inkjet / production line (GD9630 series):

- Full digital twin, meter, and consumable tracking
- GD9630 error code library and service bulletins
- Exploded diagram catalog for field parts identification
- RRA telemetry profile for GD9630 counter sets

---

## GL9730

Companion GL9730 series support parallel to GD9630:

- Shared platform modules with model-specific knowledge assets
- Cross-model part compatibility rules where applicable
- Unified fleet view with model filters and reporting segments

---

## Error Code Library

- Canonical `ErrorCodes` per model and organization overrides
- Fields: code, title, description, causes (JSON), remedies (JSON)
- Search API for technician mobile and AI grounding
- Links to manuals, bulletins, and suggested parts
- Import pipeline from manufacturer spreadsheets (future)

---

## Manual Library

- `Manuals` entity: PDF/storage references, model scope, revision, language
- Full-text search and chapter bookmarks (future)
- Customer portal download with entitlement checks
- Version supersession and deprecation notices

---

## Knowledge Base

- `KnowledgeArticles` with categories, draft/publish workflow
- Model-tagged articles for technician and AI retrieval
- Service bulletins as a specialized article type
- Contribution workflow with reviewer approval (future)

---

## Reporting

- Operational: open WOs, MTTR, first-time fix rate, PM compliance
- Fleet: utilization, alert trends, meter growth
- Inventory: stock valuation, turnover, backorders
- Financial: contracts, invoices, expenses (future modules)
- Export: CSV, PDF, scheduled email (future)
- All reports scoped by `organizationId` and role

---

## Service Hub (Dashboards)

The Matrix landing experience is presented to users as the **Service Hub**.

- Internal route remains `/dashboard` for bookmarks, middleware, and Clerk redirects.
- Optional friendly alias: `/service-hub` → redirects to `/dashboard` (no duplicate page logic).
- Executive / dispatcher / technician / inventory widgets continue to reuse existing modules (PM, service calls, inventory) — Patch 47 is naming and organization polish, not a second dashboard system.

---

## Mobile App

- Native or PWA companion for technicians
- Offline WO list, notes, photos, signatures
- Barcode scan for parts and asset tags
- Push notifications for dispatch and parts arrival
- Sync queue aligned with `syncedAt` columns in prototype schema

---

## Customer Portal

- View fleet status and open service requests
- Request PM kits and parts (guided diagrams)
- Download manuals and view service history
- Approve quotes and sign work completion
- Scoped to customer's locations and machines only

### Patch progress
- **51A** — Complete (AI Operations → Automations → Predictive Maintenance → Decision Engine → Executive Command Center)
- **51B.1** — Implemented (Customer Portal ↔ Service Hub integration; shared context, typed customer status, customer Assist mode, Hub visibility markers)
- **51C.1** — Implemented (Enterprise Intelligence aggregation on ECC; org-health bridge, parts/tech/customer analytics, Assist insights, report builder)
- **51C.2** — Implemented (Predictive Business Analytics center on ECC; demand/PM/parts/capacity forecasts, scenarios, accuracy, data quality)
- **51B.2** — In progress: Mobile Technician Experience (51B.2.1–51B.2.4 applied: work queue, Field access, signed-in identity, per-user offline storage). Remaining gates: handler-level authorization, legacy `matrix-field-offline-v1` / `tech-toby` migration, sign-out/offline revocation, and verify download/reopen, interrupted sync, conflicts, notes/photos/signatures, and completion on real devices. Not production-ready. No Onyx in this item.

---

## Technician Portal

- Focused UX for field users (subset of admin web)
- Work order queue, machine detail, AI technician
- Inventory on truck, parts ordering, diagram picker
- Time tracking and expense capture (future)
- Mobile-optimized layouts

---

## Future Expansion

| Area | Direction |
|------|-----------|
| **Billing** | Contracts, invoices, expense integration with ERP |
| **Training** | Certifications, courses, technician skill matrix |
| **Messaging** | In-app announcements and WO threaded messages |
| **SSO / SAML** | Enterprise identity provider integration |
| **GraphQL API** | Flexible queries for mobile and partners |
| **Webhooks** | Event subscriptions for external systems |
| **Multi-language** | i18n for portals and manuals |
| **FT / FW / X1 families** | Additional RISO device lines in catalog |
| **Predictive maintenance** | ML on telemetry for failure prediction |
| **Partner API** | Third-party dealer and distributor access |

---

## Related documents

- `docs/database/ENTITY_RELATIONSHIP.md` — Full data model
- `docs/api/API_ROADMAP.md` — REST endpoint catalog
- `docs/security/SECURITY.md` — Security and compliance controls

---

*PATCH-19 Enterprise Foundation — documentation only. Existing prototype UI and features remain unchanged.*


### 51B.2.2 delivery checkpoint
- Field Access Checks: applied. Signed-out users still go to sign-in. Configured technician/admin roles with VIEW_FIELD may enter /field. Customer, missing, and invalid roles get 403. Identity lookup failure returns 503. Live Clerk role checks still need a signed-in browser pass.
- 51B.2 remains in progress. Demo identity replacement, offline isolation, handler-level authorization and real-device workflow validation remain open.
