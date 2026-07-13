-- Patch 43: Enterprise Inventory & Warehouse Management
-- Additive only — preserves existing inventory / warehouse location data.

CREATE TABLE IF NOT EXISTS "Warehouse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT,
    "manager" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "receivingDock" TEXT,
    "shippingArea" TEXT,
    "hours" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "region" TEXT,
    "enterpriseLocationId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "Warehouse_code_key" ON "Warehouse"("code");
CREATE INDEX IF NOT EXISTS "Warehouse_status_idx" ON "Warehouse"("status");
CREATE INDEX IF NOT EXISTS "Warehouse_enterpriseLocationId_idx" ON "Warehouse"("enterpriseLocationId");

CREATE TABLE IF NOT EXISTS "WarehouseBinLocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "warehouseId" TEXT NOT NULL,
    "zone" TEXT NOT NULL,
    "aisle" TEXT NOT NULL,
    "rack" TEXT NOT NULL,
    "shelf" TEXT NOT NULL,
    "bin" TEXT NOT NULL,
    "drawer" TEXT NOT NULL DEFAULT '',
    "code" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WarehouseBinLocation_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "WarehouseBinLocation_warehouseId_code_key" ON "WarehouseBinLocation"("warehouseId", "code");
CREATE INDEX IF NOT EXISTS "WarehouseBinLocation_code_idx" ON "WarehouseBinLocation"("code");
CREATE INDEX IF NOT EXISTS "WarehouseBinLocation_zone_aisle_idx" ON "WarehouseBinLocation"("zone", "aisle");

CREATE TABLE IF NOT EXISTS "WarehouseTransfer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transferNumber" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "fromWarehouseId" TEXT NOT NULL,
    "toWarehouseId" TEXT NOT NULL,
    "fromLocationId" TEXT,
    "toLocationId" TEXT,
    "requestedBy" TEXT,
    "approvedBy" TEXT,
    "notes" TEXT,
    "emergency" BOOLEAN NOT NULL DEFAULT false,
    "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" DATETIME,
    "shippedAt" DATETIME,
    "deliveredAt" DATETIME,
    "receivedAt" DATETIME,
    "cancelledAt" DATETIME,
    CONSTRAINT "WarehouseTransfer_fromWarehouseId_fkey" FOREIGN KEY ("fromWarehouseId") REFERENCES "Warehouse" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WarehouseTransfer_toWarehouseId_fkey" FOREIGN KEY ("toWarehouseId") REFERENCES "Warehouse" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "WarehouseTransfer_transferNumber_key" ON "WarehouseTransfer"("transferNumber");
CREATE INDEX IF NOT EXISTS "WarehouseTransfer_status_idx" ON "WarehouseTransfer"("status");

CREATE TABLE IF NOT EXISTS "WarehouseTransferLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transferId" TEXT NOT NULL,
    "partId" TEXT,
    "partNumber" TEXT NOT NULL,
    "description" TEXT,
    "quantityRequested" INTEGER NOT NULL,
    "quantityShipped" INTEGER NOT NULL DEFAULT 0,
    "quantityReceived" INTEGER NOT NULL DEFAULT 0,
    "binFromId" TEXT,
    "binToId" TEXT,
    CONSTRAINT "WarehouseTransferLine_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "WarehouseTransfer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "WarehouseReceivingSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionNumber" TEXT NOT NULL,
    "purchaseRequestId" TEXT,
    "purchaseRequestNumber" TEXT,
    "warehouseId" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "receiver" TEXT,
    "labelsPrinted" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "WarehouseReceivingSession_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "WarehouseReceivingSession_sessionNumber_key" ON "WarehouseReceivingSession"("sessionNumber");

CREATE TABLE IF NOT EXISTS "WarehouseReceivingLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "partId" TEXT,
    "partNumber" TEXT NOT NULL,
    "description" TEXT,
    "expectedQty" INTEGER NOT NULL,
    "receivedQty" INTEGER NOT NULL DEFAULT 0,
    "inspectedOk" BOOLEAN NOT NULL DEFAULT false,
    "inspectNotes" TEXT,
    "binLocationId" TEXT,
    "locationCode" TEXT,
    CONSTRAINT "WarehouseReceivingLine_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WarehouseReceivingSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "WarehouseCycleCount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "countNumber" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "categoryFilter" TEXT,
    "binFilter" TEXT,
    "createdBy" TEXT,
    "approvedBy" TEXT,
    "notes" TEXT,
    "scheduledAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "WarehouseCycleCount_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "WarehouseCycleCount_countNumber_key" ON "WarehouseCycleCount"("countNumber");

CREATE TABLE IF NOT EXISTS "WarehouseCycleCountLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cycleCountId" TEXT NOT NULL,
    "partId" TEXT,
    "partNumber" TEXT NOT NULL,
    "description" TEXT,
    "binLocationId" TEXT,
    "locationCode" TEXT,
    "expectedQty" INTEGER NOT NULL,
    "actualQty" INTEGER,
    "variance" INTEGER,
    "reason" TEXT,
    CONSTRAINT "WarehouseCycleCountLine_cycleCountId_fkey" FOREIGN KEY ("cycleCountId") REFERENCES "WarehouseCycleCount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "TruckRestockRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestNumber" TEXT NOT NULL,
    "truckLocationId" TEXT NOT NULL,
    "truckName" TEXT,
    "technician" TEXT,
    "sourceWarehouseId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdBy" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "TruckRestockRequest_sourceWarehouseId_fkey" FOREIGN KEY ("sourceWarehouseId") REFERENCES "Warehouse" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "TruckRestockRequest_requestNumber_key" ON "TruckRestockRequest"("requestNumber");

CREATE TABLE IF NOT EXISTS "TruckRestockLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "partId" TEXT,
    "partNumber" TEXT NOT NULL,
    "description" TEXT,
    "currentQty" INTEGER NOT NULL,
    "recommendedQty" INTEGER NOT NULL,
    "missingQty" INTEGER NOT NULL,
    "critical" BOOLEAN NOT NULL DEFAULT false,
    "fastMoving" BOOLEAN NOT NULL DEFAULT false,
    "emergencyKit" BOOLEAN NOT NULL DEFAULT false,
    "consumable" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "TruckRestockLine_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "TruckRestockRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "WarehouseInventoryAlert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "warehouseId" TEXT,
    "partNumber" TEXT,
    "referenceId" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" DATETIME,
    CONSTRAINT "WarehouseInventoryAlert_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "WarehouseEmployee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "warehouseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "WarehouseEmployee_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "WarehouseAuditEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "technician" TEXT,
    "warehouseId" TEXT,
    "inventoryItemId" TEXT,
    "partNumber" TEXT,
    "quantityBefore" INTEGER,
    "quantityAfter" INTEGER,
    "adjustment" INTEGER,
    "reason" TEXT NOT NULL,
    "referenceNumber" TEXT,
    "sourceModule" TEXT,
    "ipAddress" TEXT,
    "device" TEXT
);

CREATE INDEX IF NOT EXISTS "WarehouseAuditEntry_warehouseId_timestamp_idx" ON "WarehouseAuditEntry"("warehouseId", "timestamp");
