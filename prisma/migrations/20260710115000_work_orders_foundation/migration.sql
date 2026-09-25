-- Work order tables (required before field offline sync references workOrderId).

CREATE TABLE IF NOT EXISTS "WorkOrder" (
    "id" TEXT NOT NULL,
    "workOrderNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "customerId" TEXT,
    "siteId" TEXT,
    "printerId" TEXT,
    "serviceTicketId" TEXT,
    "serviceType" TEXT,
    "priority" TEXT,
    "status" TEXT,
    "source" TEXT,
    "assignedTechnician" TEXT,
    "secondaryTechnician" TEXT,
    "requestedBy" TEXT,
    "createdBy" TEXT,
    "scheduledStart" DATETIME,
    "scheduledEnd" DATETIME,
    "actualStart" DATETIME,
    "actualEnd" DATETIME,
    "completedDate" DATETIME,
    "estimatedHours" REAL,
    "actualHours" REAL,
    "travelTime" REAL,
    "mileage" REAL,
    "laborRate" REAL,
    "laborCost" REAL,
    "notes" TEXT,
    "internalNotes" TEXT,
    "customerVisibleNotes" TEXT,
    "customerSignature" TEXT,
    "copyCountAtStart" INTEGER,
    "copyCountAtEnd" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,

    CONSTRAINT "WorkOrder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WorkOrder_workOrderNumber_key" ON "WorkOrder"("workOrderNumber");
CREATE INDEX IF NOT EXISTS "WorkOrder_status_priority_idx" ON "WorkOrder"("status", "priority");
CREATE INDEX IF NOT EXISTS "WorkOrder_assignedTechnician_scheduledStart_idx" ON "WorkOrder"("assignedTechnician", "scheduledStart");
CREATE INDEX IF NOT EXISTS "WorkOrder_printerId_idx" ON "WorkOrder"("printerId");
CREATE INDEX IF NOT EXISTS "WorkOrder_customerId_idx" ON "WorkOrder"("customerId");

CREATE TABLE IF NOT EXISTS "WorkOrderTimelineEvent" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "actor" TEXT,
    "previousValue" TEXT,
    "newValue" TEXT,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkOrderTimelineEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WorkOrderTimelineEvent_workOrderId_occurredAt_idx" ON "WorkOrderTimelineEvent"("workOrderId", "occurredAt");

CREATE TABLE IF NOT EXISTS "WorkOrderAuditEntry" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "previousValue" TEXT,
    "newValue" TEXT,
    "actor" TEXT,
    "action" TEXT,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkOrderAuditEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WorkOrderAuditEntry_workOrderId_occurredAt_idx" ON "WorkOrderAuditEntry"("workOrderId", "occurredAt");

CREATE TABLE IF NOT EXISTS "WorkOrderPartLine" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "partNumber" TEXT NOT NULL,
    "description" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitCost" REAL,
    "source" TEXT,
    "addedBy" TEXT,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkOrderPartLine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WorkOrderPartLine_workOrderId_idx" ON "WorkOrderPartLine"("workOrderId");

CREATE TABLE IF NOT EXISTS "WorkOrderFile" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "kind" TEXT,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "uploadedBy" TEXT,
    "storageRef" TEXT,
    "notes" TEXT,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkOrderFile_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WorkOrderFile_workOrderId_uploadedAt_idx" ON "WorkOrderFile"("workOrderId", "uploadedAt");
