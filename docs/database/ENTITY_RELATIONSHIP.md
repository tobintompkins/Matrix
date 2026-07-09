# Matrix Entity Relationship Documentation

**Patch:** PATCH-19 Enterprise Foundation  
**Purpose:** Canonical enterprise data model for Matrix platform tables  
**ID strategy:** UUID v4 primary keys (`id`); migrate from prototype `cuid()` during implementation

---

## Standard columns (all tables)

Every table listed below includes these columns unless noted in **Exceptions**.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `organizationId` | UUID | Tenant foreign key → `Organizations.id` |
| `createdAt` | DateTime | Record creation timestamp (UTC) |
| `updatedAt` | DateTime | Last modification timestamp (UTC) |
| `deletedAt` | DateTime? | Soft-delete timestamp; `NULL` = active |
| `createdBy` | UUID? | FK → `Users.id`; user who created the row |
| `updatedBy` | UUID? | FK → `Users.id`; user who last updated the row |

### Exceptions

| Table | Notes |
|-------|-------|
| **Organizations** | Root tenant; `organizationId` is `NULL`. No `deletedAt` purge without legal hold workflow. |
| **Permissions** | Global catalog; `organizationId` is `NULL` for system permissions. Org-specific overrides use `organizationId`. |
| **AuditLog** | Append-only; no `updatedAt`, `updatedBy`, or `deletedAt`. |
| **InventoryTransactions** | Append-only ledger; no `deletedAt` (use reversing transaction). |
| **Telemetry** | High-volume time-series; optional partition by `readAt`; `updatedAt`/`updatedBy` may be omitted. |

### Prototype mapping

Current Prisma schema (`prisma/schema.prisma`) uses overlapping names: `Printer` → **Machines**, `ServiceTicket` → **WorkOrders** / **ServiceCalls**, `PrinterModel` → **MachineModels**, `WarehouseLocation` → **Warehouses**, `PartOrder` → **PurchaseOrders**, `KnowledgeBaseArticle` → **KnowledgeArticles**. This document defines the enterprise target names.

---

## Entity relationship overview

```
Organizations
  ├── Users ──┬── Roles (via UserRoles)
  │           └── Technicians (profile extension)
  ├── Customers
  │     └── Locations
  │           └── Machines
  ├── Warehouses
  │     └── Inventory ── InventoryTransactions
  ├── Parts ──┬── PartCategories
  │           ├── PartImages
  │           └── PartDiagrams ── DiagramCallouts
  ├── PurchaseOrders ── OrderItems ── Shipments
  ├── ServiceCalls / WorkOrders
  ├── PreventiveMaintenance
  ├── RRADevices ── Telemetry ── PrinterCounters ── Consumables
  ├── Contracts ── Invoices ── Expenses
  ├── Training ── Certifications
  ├── Messages ── Announcements
  ├── Settings
  ├── AuditLog
  ├── Notifications
  ├── AIConversations
  ├── KnowledgeArticles
  ├── Manuals
  └── ErrorCodes (model-scoped)
```

---

## Table definitions

### Organizations

Root tenant entity for multi-organization support.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `organizationId` | UUID? | Always `NULL` (root) |
| `name` | String | Legal or trade name |
| `slug` | String? | Unique URL identifier |
| `settings` | JSON? | Feature flags, branding (see **Settings**) |
| `status` | String | active \| suspended \| trial |
| + standard audit | | except `organizationId` self-reference |

**Relationships:** One-to-many to all org-scoped tables.

---

### Users

Platform accounts belonging to an organization.

| Column | Type | Notes |
|--------|------|-------|
| `email` | String | Unique per `organizationId` |
| `name` | String? | Display name |
| `passwordHash` | String? | Null when SSO-only |
| `status` | String | active \| inactive \| invited |
| `lastLoginAt` | DateTime? | |
| `syncedAt` | DateTime? | Offline sync marker |

**Relationships:** `UserRoles` → Roles; creator/updater on all mutable entities.

---

### Roles

Named permission bundles within an organization.

| Column | Type | Notes |
|--------|------|-------|
| `name` | String | Unique per `organizationId` |
| `description` | String? | |
| `isSystem` | Boolean | Built-in roles cannot be deleted |

**Relationships:** Many-to-many with Users via join table `UserRoles` (id, userId, roleId + standard columns).

---

### Permissions

Atomic capability keys (global or org-specific).

| Column | Type | Notes |
|--------|------|-------|
| `key` | String | e.g. `workorders.write` |
| `description` | String? | |
| `module` | String? | Grouping for UI |

**Relationships:** Referenced in `Roles.permissions` JSON array; future normalized `RolePermissions` join.

---

### Customers

Service accounts / end customers.

| Column | Type | Notes |
|--------|------|-------|
| `name` | String | |
| `accountNumber` | String? | ERP reference |
| `status` | String? | active \| inactive |
| `primaryContactEmail` | String? | |
| `syncedAt` | DateTime? | |

**Relationships:** One-to-many **Locations**; optional **Contracts**.

---

### Locations

Customer sites (buildings, rooms, plants).

| Column | Type | Notes |
|--------|------|-------|
| `customerId` | UUID | FK → Customers |
| `name` | String | |
| `address` | String? | |
| `city` | String? | |
| `region` | String? | State/province |
| `postalCode` | String? | |
| `country` | String? | |
| `timezone` | String? | |
| `syncedAt` | DateTime? | |

**Relationships:** One-to-many **Machines**.

---

### Machines

Physical installed assets (prototype: `Printer`).

| Column | Type | Notes |
|--------|------|-------|
| `locationId` | UUID | FK → Locations |
| `machineModelId` | UUID | FK → MachineModels |
| `assetId` | String? | Unique customer asset tag |
| `serialNumber` | String? | |
| `status` | String? | active \| warning \| fault \| offline |
| `firmwareVersion` | String? | |
| `installedAt` | DateTime? | |
| `syncedAt` | DateTime? | |

**Relationships:** ServiceCalls, WorkOrders, PM, Telemetry, RRADevices, Attachments.

---

### MachineModels

Equipment catalog (prototype: `PrinterModel`).

| Column | Type | Notes |
|--------|------|-------|
| `manufacturerId` | UUID? | FK → Manufacturers |
| `name` | String | e.g. GD9630, GL9730, Valezus |
| `series` | String? | |
| `deviceType` | String? | |
| `capabilities` | JSON? | Supported features |

**Relationships:** Machines, ErrorCodes, Manuals, PartDiagrams, PM templates.

---

### Manufacturers

OEM and brand records (e.g. RISO).

| Column | Type | Notes |
|--------|------|-------|
| `name` | String | Unique |
| `website` | String? | |
| `supportEmail` | String? | |

**Relationships:** One-to-many MachineModels.

---

### ServiceCalls

Inbound service requests (may spawn WorkOrders).

| Column | Type | Notes |
|--------|------|-------|
| `callNumber` | String? | Unique per org |
| `machineId` | UUID? | FK → Machines |
| `customerId` | UUID? | FK → Customers |
| `reportedBy` | String? | Caller name |
| `channel` | String? | phone \| portal \| rra \| email |
| `issueSummary` | String? | |
| `priority` | String? | |
| `status` | String? | open \| converted \| closed |
| `openedAt` | DateTime? | |
| `closedAt` | DateTime? | |

**Relationships:** Optional one-to-one **WorkOrders**; Notes, Attachments.

---

### WorkOrders

Field service jobs (prototype: `ServiceTicket`).

| Column | Type | Notes |
|--------|------|-------|
| `workOrderNumber` | String? | Unique per org |
| `serviceCallId` | UUID? | FK → ServiceCalls |
| `machineId` | UUID | FK → Machines |
| `assignedTechnicianId` | UUID? | FK → Users / Technicians |
| `status` | String? | draft \| open \| in_progress \| waiting_parts \| completed \| closed |
| `priority` | String? | |
| `jobType` | String? | repair \| install \| pm \| inspection |
| `problemDescription` | String? | |
| `resolution` | String? | |
| `openedAt` | DateTime? | |
| `closedAt` | DateTime? | |
| `syncedAt` | DateTime? | |

**Relationships:** Notes, Attachments, PartOrders/PurchaseOrders, AIConversations, InventoryTransactions (issues).

---

### PreventiveMaintenance

PM schedules and completed events (prototype: `PMHistory` + `PMKitTemplate`).

| Column | Type | Notes |
|--------|------|-------|
| `machineId` | UUID | FK → Machines |
| `templateId` | UUID? | PM kit / checklist template |
| `scheduledAt` | DateTime? | |
| `performedAt` | DateTime? | |
| `performedById` | UUID? | FK → Users |
| `meterAtService` | Int? | |
| `status` | String? | scheduled \| completed \| skipped \| overdue |
| `notes` | String? | |
| `syncedAt` | DateTime? | |

**Relationships:** Consumes inventory via InventoryTransactions; linked OrderItems for PM kits.

---

### ErrorCodes

Model-scoped fault dictionary.

| Column | Type | Notes |
|--------|------|-------|
| `machineModelId` | UUID? | FK → MachineModels |
| `code` | String | e.g. E-1234 |
| `title` | String? | |
| `description` | String? | |
| `causes` | JSON? | Array of cause strings |
| `remedies` | JSON? | Array of remedy steps |
| `severity` | String? | info \| warning \| critical |

**Relationships:** Linked from Telemetry alerts, AI context, KnowledgeArticles.

---

### Inventory

Stock balance per part per warehouse.

| Column | Type | Notes |
|--------|------|-------|
| `partId` | UUID | FK → Parts |
| `warehouseId` | UUID | FK → Warehouses |
| `quantity` | Int | Default 0 |
| `reorderPoint` | Int? | |
| `syncedAt` | DateTime? | |

**Unique:** (`partId`, `warehouseId`, `organizationId`)

---

### InventoryTransactions

Immutable stock movement ledger.

| Column | Type | Notes |
|--------|------|-------|
| `partId` | UUID | FK → Parts |
| `warehouseId` | UUID | FK → Warehouses |
| `quantity` | Int | Signed delta |
| `transactionType` | String | receive \| issue \| transfer \| adjust \| return |
| `referenceType` | String? | work_order \| purchase_order \| pm |
| `referenceId` | UUID? | Polymorphic FK |
| `notes` | String? | |

**Note:** Append-only; use reversing entries instead of delete.

---

### Warehouses

Stock locations including trucks (prototype: `WarehouseLocation`).

| Column | Type | Notes |
|--------|------|-------|
| `name` | String | |
| `type` | String? | warehouse \| truck \| staging |
| `address` | String? | |
| `assignedTechnicianId` | UUID? | For mobile truck stock |

---

### Parts

Master parts catalog.

| Column | Type | Notes |
|--------|------|-------|
| `partNumber` | String | Unique per org or global |
| `name` | String | |
| `description` | String? | |
| `categoryId` | UUID? | FK → PartCategories |
| `unitCost` | Decimal? | |
| `reorderLevel` | Int? | |
| `syncedAt` | DateTime? | |

**Relationships:** Inventory, PartImages, PartDiagrams callouts, OrderItems.

---

### PartCategories

Hierarchy for parts browsing.

| Column | Type | Notes |
|--------|------|-------|
| `name` | String | |
| `parentId` | UUID? | Self-FK for tree |
| `sortOrder` | Int? | |

---

### PartImages

Media assets for parts.

| Column | Type | Notes |
|--------|------|-------|
| `partId` | UUID | FK → Parts |
| `storageKey` | String | Object storage path |
| `mimeType` | String? | |
| `isPrimary` | Boolean | Default false |
| `sortOrder` | Int? | |

---

### PartDiagrams

Exploded views for guided ordering.

| Column | Type | Notes |
|--------|------|-------|
| `machineModelId` | UUID? | FK → MachineModels |
| `title` | String | |
| `storageKey` | String | Image or SVG |
| `revision` | String? | |
| `width` | Int? | Canvas pixels |
| `height` | Int? | |

**Relationships:** One-to-many **DiagramCallouts**.

---

### DiagramCallouts

Hotspots on diagrams mapping to parts.

| Column | Type | Notes |
|--------|------|-------|
| `partDiagramId` | UUID | FK → PartDiagrams |
| `partId` | UUID | FK → Parts |
| `calloutNumber` | String? | Label on diagram |
| `x` | Float | Normalized 0–1 |
| `y` | Float | Normalized 0–1 |
| `width` | Float? | Hotspot width |
| `height` | Float? | Hotspot height |

---

### PurchaseOrders

Parts purchase and internal fulfillment (prototype: `PartOrder`).

| Column | Type | Notes |
|--------|------|-------|
| `orderNumber` | String? | Unique per org |
| `status` | String? | draft \| submitted \| approved \| shipped \| received \| cancelled |
| `priority` | String? | |
| `requestType` | String? | stock \| field \| customer |
| `neededBy` | DateTime? | |
| `machineId` | UUID? | FK → Machines |
| `workOrderId` | UUID? | FK → WorkOrders |
| `requestedById` | UUID? | FK → Users |
| `vendorName` | String? | |
| `syncedAt` | DateTime? | |

**Relationships:** OrderItems, Shipments, Notes.

---

### OrderItems

Line items on purchase orders (prototype: `PartOrderItem`).

| Column | Type | Notes |
|--------|------|-------|
| `purchaseOrderId` | UUID | FK → PurchaseOrders |
| `partId` | UUID | FK → Parts |
| `quantity` | Int | Default 1 |
| `unitPrice` | Decimal? | |
| `quantityReceived` | Int | Default 0 |

---

### Shipments

Fulfillment tracking for orders.

| Column | Type | Notes |
|--------|------|-------|
| `purchaseOrderId` | UUID | FK → PurchaseOrders |
| `carrier` | String? | |
| `trackingNumber` | String? | |
| `shippedAt` | DateTime? | |
| `deliveredAt` | DateTime? | |
| `status` | String? | pending \| in_transit \| delivered |

---

### Attachments

Files linked to entities.

| Column | Type | Notes |
|--------|------|-------|
| `fileName` | String? | |
| `mimeType` | String? | |
| `storageKey` | String? | |
| `entityType` | String? | machine \| work_order \| customer |
| `entityId` | UUID? | Polymorphic FK |
| `uploadedById` | UUID? | FK → Users |
| `syncedAt` | DateTime? | |

---

### Notes

Text notes on entities (prototype: `TechnicianNote`).

| Column | Type | Notes |
|--------|------|-------|
| `body` | String | |
| `entityType` | String | machine \| work_order \| service_call |
| `entityId` | UUID | Polymorphic FK |
| `authorId` | UUID? | FK → Users |
| `isInternal` | Boolean | Hidden from customer portal |
| `syncedAt` | DateTime? | |

---

### AuditLog

Immutable compliance trail.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `organizationId` | UUID? | |
| `createdAt` | DateTime | Only created timestamp |
| `actorId` | UUID? | FK → Users |
| `action` | String | e.g. workorder.update |
| `entityType` | String? | |
| `entityId` | UUID? | |
| `payload` | JSON? | Before/after snapshot |
| `ipAddress` | String? | |
| `userAgent` | String? | |

**No** `updatedAt`, `updatedBy`, `deletedAt`.

---

### Notifications

User and org alerts.

| Column | Type | Notes |
|--------|------|-------|
| `userId` | UUID? | FK → Users; null = broadcast |
| `type` | String? | alert \| assignment \| stock |
| `title` | String? | |
| `body` | String? | |
| `readAt` | DateTime? | |
| `entityType` | String? | |
| `entityId` | UUID? | |

---

### AIConversations

AI chat threads (prototype: `AIConversation` + `AIMessage`).

| Column | Type | Notes |
|--------|------|-------|
| `userId` | UUID? | FK → Users |
| `title` | String? | |
| `context` | JSON? | Machine/ticket/error snapshot |
| `machineId` | UUID? | FK → Machines |
| `workOrderId` | UUID? | FK → WorkOrders |

**Child table `AIMessages`:** conversationId, role, content, createdAt (+ standard where applicable).

---

### KnowledgeArticles

Published troubleshooting and how-to content.

| Column | Type | Notes |
|--------|------|-------|
| `machineModelId` | UUID? | FK → MachineModels |
| `title` | String | |
| `category` | String? | |
| `body` | String? | Markdown or HTML |
| `status` | String? | draft \| published \| archived |
| `publishedAt` | DateTime? | |

---

### Manuals

Official OEM documentation library.

| Column | Type | Notes |
|--------|------|-------|
| `machineModelId` | UUID? | FK → MachineModels |
| `title` | String | |
| `documentType` | String? | service \| parts \| operator |
| `revision` | String? | |
| `language` | String? | ISO 639-1 |
| `storageKey` | String | PDF or asset path |
| `publishedAt` | DateTime? | |

---

### RRADevices

Registered RRA endpoints per machine.

| Column | Type | Notes |
|--------|------|-------|
| `machineId` | UUID | FK → Machines |
| `rraDeviceId` | String? | External RRA identifier |
| `host` | String? | Network address |
| `lastSeenAt` | DateTime? | |
| `connectionStatus` | String? | online \| offline \| error |
| `config` | JSON? | Polling intervals, credentials ref |

---

### Telemetry

Generic telemetry events from RRA or agents.

| Column | Type | Notes |
|--------|------|-------|
| `machineId` | UUID | FK → Machines |
| `rraDeviceId` | UUID? | FK → RRADevices |
| `eventType` | String | counter \| alert \| status |
| `payload` | JSON | Raw reading |
| `readAt` | DateTime | Event timestamp |

**Index:** (`machineId`, `readAt`)

---

### PrinterCounters

Normalized meter readings (prototype: `MeterHistory`).

| Column | Type | Notes |
|--------|------|-------|
| `machineId` | UUID | FK → Machines |
| `totalCount` | Int? | |
| `blackCount` | Int? | |
| `colorCount` | Int? | |
| `readAt` | DateTime | |
| `source` | String? | manual \| rra \| technician |

---

### Consumables

Ink, drums, and supply levels.

| Column | Type | Notes |
|--------|------|-------|
| `machineId` | UUID | FK → Machines |
| `consumableType` | String | ink \| drum \| waste |
| `color` | String? | black \| cyan \| etc. |
| `levelPercent` | Int? | 0–100 |
| `partId` | UUID? | FK → Parts when mappable |
| `readAt` | DateTime | |

---

### Contracts

Service agreements with customers.

| Column | Type | Notes |
|--------|------|-------|
| `customerId` | UUID | FK → Customers |
| `contractNumber` | String? | |
| `startDate` | DateTime? | |
| `endDate` | DateTime? | |
| `terms` | JSON? | SLA, included PM, response times |
| `status` | String? | active \| expired \| cancelled |

---

### Invoices

Billing documents (future module).

| Column | Type | Notes |
|--------|------|-------|
| `customerId` | UUID | FK → Customers |
| `contractId` | UUID? | FK → Contracts |
| `invoiceNumber` | String? | |
| `amount` | Decimal? | |
| `currency` | String? | ISO 4217 |
| `issuedAt` | DateTime? | |
| `dueAt` | DateTime? | |
| `status` | String? | draft \| sent \| paid \| void |

---

### Expenses

Technician or org expenses linked to work.

| Column | Type | Notes |
|--------|------|-------|
| `workOrderId` | UUID? | FK → WorkOrders |
| `userId` | UUID? | FK → Users |
| `category` | String? | travel \| parts \| lodging |
| `amount` | Decimal? | |
| `currency` | String? | |
| `receiptStorageKey` | String? | |
| `status` | String? | pending \| approved \| reimbursed |

---

### Training

Training courses and materials.

| Column | Type | Notes |
|--------|------|-------|
| `title` | String | |
| `description` | String? | |
| `machineModelId` | UUID? | Optional model scope |
| `durationMinutes` | Int? | |
| `storageKey` | String? | Content asset |
| `isRequired` | Boolean | Default false |

---

### Certifications

Technician credentials.

| Column | Type | Notes |
|--------|------|-------|
| `userId` | UUID | FK → Users |
| `trainingId` | UUID? | FK → Training |
| `certificationName` | String | |
| `issuedAt` | DateTime? | |
| `expiresAt` | DateTime? | |
| `credentialId` | String? | External cert number |

---

### Technicians

Extended profile for field users (1:1 with User).

| Column | Type | Notes |
|--------|------|-------|
| `userId` | UUID | Unique FK → Users |
| `employeeId` | String? | |
| `phone` | String? | |
| `homeWarehouseId` | UUID? | FK → Warehouses |
| `skills` | JSON? | Model certifications |
| `isAvailable` | Boolean | Dispatch flag |

---

### Schedules

Technician and PM calendar entries.

| Column | Type | Notes |
|--------|------|-------|
| `technicianId` | UUID? | FK → Technicians |
| `workOrderId` | UUID? | FK → WorkOrders |
| `preventiveMaintenanceId` | UUID? | FK → PreventiveMaintenance |
| `startAt` | DateTime | |
| `endAt` | DateTime? | |
| `status` | String? | scheduled \| confirmed \| completed |

---

### Messages

Threaded messages on work orders or service calls.

| Column | Type | Notes |
|--------|------|-------|
| `threadType` | String | work_order \| service_call |
| `threadId` | UUID | |
| `authorId` | UUID? | FK → Users |
| `body` | String | |
| `readBy` | JSON? | Array of user IDs |

---

### Announcements

Org-wide broadcasts.

| Column | Type | Notes |
|--------|------|-------|
| `title` | String | |
| `body` | String | |
| `publishedAt` | DateTime? | |
| `expiresAt` | DateTime? | |
| `audience` | String? | all \| technicians \| customers |

---

### Settings

Key-value org configuration (may also live in `Organizations.settings` JSON).

| Column | Type | Notes |
|--------|------|-------|
| `key` | String | Unique per `organizationId` |
| `value` | JSON | Typed per key schema |
| `category` | String? | integrations \| branding \| features |

---

## Indexing strategy

- All tables: index on `organizationId` where not null
- Soft delete: composite index `(organizationId, deletedAt)` for active-row queries
- Foreign keys: index on all `*Id` columns
- Full-text (future): `ErrorCodes.code`, `Parts.partNumber`, `KnowledgeArticles.title`

---

## Migration notes (prototype → enterprise)

1. Rename `Printer` → `Machines`, add missing standard columns
2. Add `createdBy` / `updatedBy` via backfill from `AuditLog` where possible
3. Convert `cuid()` → UUID on cutover or maintain mapping table
4. Introduce `InventoryTransactions` for all stock changes
5. Split `ServiceTicket` into `ServiceCalls` + `WorkOrders` if dual workflow needed

---

*See `docs/blueprints/MATRIX_MASTER_BLUEPRINT.md` and `docs/api/API_ROADMAP.md` for module and API alignment.*
