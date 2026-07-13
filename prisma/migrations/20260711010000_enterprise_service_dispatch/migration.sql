-- Patch 41: Enterprise Service Ticket & Dispatch Center

ALTER TABLE "ServiceTicket" ADD COLUMN "customerId" TEXT;
ALTER TABLE "ServiceTicket" ADD COLUMN "customerLocationId" TEXT;
ALTER TABLE "ServiceTicket" ADD COLUMN "printerSerialNumber" TEXT;
ALTER TABLE "ServiceTicket" ADD COLUMN "printerModel" TEXT;
ALTER TABLE "ServiceTicket" ADD COLUMN "title" TEXT;
ALTER TABLE "ServiceTicket" ADD COLUMN "description" TEXT;
ALTER TABLE "ServiceTicket" ADD COLUMN "problemCategory" TEXT;
ALTER TABLE "ServiceTicket" ADD COLUMN "assignedBy" TEXT;
ALTER TABLE "ServiceTicket" ADD COLUMN "source" TEXT;
ALTER TABLE "ServiceTicket" ADD COLUMN "requestedBy" TEXT;
ALTER TABLE "ServiceTicket" ADD COLUMN "requestedByEmail" TEXT;
ALTER TABLE "ServiceTicket" ADD COLUMN "requestedByPhone" TEXT;
ALTER TABLE "ServiceTicket" ADD COLUMN "acknowledgedAt" DATETIME;
ALTER TABLE "ServiceTicket" ADD COLUMN "scheduledStart" DATETIME;
ALTER TABLE "ServiceTicket" ADD COLUMN "scheduledEnd" DATETIME;
ALTER TABLE "ServiceTicket" ADD COLUMN "technicianArrivalTime" DATETIME;
ALTER TABLE "ServiceTicket" ADD COLUMN "workStartedAt" DATETIME;
ALTER TABLE "ServiceTicket" ADD COLUMN "workCompletedAt" DATETIME;
ALTER TABLE "ServiceTicket" ADD COLUMN "responseTimeMinutes" INTEGER;
ALTER TABLE "ServiceTicket" ADD COLUMN "repairTimeMinutes" INTEGER;
ALTER TABLE "ServiceTicket" ADD COLUMN "totalDowntimeMinutes" INTEGER;
ALTER TABLE "ServiceTicket" ADD COLUMN "meterCountAtOpen" INTEGER;
ALTER TABLE "ServiceTicket" ADD COLUMN "meterCountAtClose" INTEGER;
ALTER TABLE "ServiceTicket" ADD COLUMN "resolutionSummary" TEXT;
ALTER TABLE "ServiceTicket" ADD COLUMN "internalNotes" TEXT;
ALTER TABLE "ServiceTicket" ADD COLUMN "customerNotes" TEXT;
ALTER TABLE "ServiceTicket" ADD COLUMN "customerSignature" TEXT;
ALTER TABLE "ServiceTicket" ADD COLUMN "customerSignatureDate" DATETIME;
ALTER TABLE "ServiceTicket" ADD COLUMN "customerSatisfactionRating" INTEGER;
ALTER TABLE "ServiceTicket" ADD COLUMN "followUpRequired" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ServiceTicket" ADD COLUMN "followUpDate" DATETIME;
ALTER TABLE "ServiceTicket" ADD COLUMN "warrantyStatus" TEXT;
ALTER TABLE "ServiceTicket" ADD COLUMN "serviceContractStatus" TEXT;
ALTER TABLE "ServiceTicket" ADD COLUMN "billable" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ServiceTicket" ADD COLUMN "laborHours" REAL;
ALTER TABLE "ServiceTicket" ADD COLUMN "travelHours" REAL;
ALTER TABLE "ServiceTicket" ADD COLUMN "mileage" REAL;
ALTER TABLE "ServiceTicket" ADD COLUMN "remoteResolution" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ServiceTicket" ADD COLUMN "escalationLevel" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ServiceTicket" ADD COLUMN "parentTicketId" TEXT;
ALTER TABLE "ServiceTicket" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS "ServiceTicket_priority_idx" ON "ServiceTicket"("priority");
CREATE INDEX IF NOT EXISTS "ServiceTicket_customerId_idx" ON "ServiceTicket"("customerId");
CREATE INDEX IF NOT EXISTS "ServiceTicket_printerSerialNumber_idx" ON "ServiceTicket"("printerSerialNumber");

CREATE TABLE IF NOT EXISTS "ServiceTicketUpdate" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "updateType" TEXT NOT NULL,
    "previousStatus" TEXT,
    "newStatus" TEXT,
    "message" TEXT,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "visibleToCustomer" BOOLEAN NOT NULL DEFAULT false,
    "attachmentUrl" TEXT,
    CONSTRAINT "ServiceTicketUpdate_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ServiceTicketUpdate_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ServiceTicket"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ServiceTicketUpdate_ticketId_createdAt_idx" ON "ServiceTicketUpdate"("ticketId", "createdAt");

CREATE TABLE IF NOT EXISTS "ServiceTicketPart" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "partId" TEXT,
    "partNumber" TEXT,
    "description" TEXT,
    "quantityRequested" INTEGER NOT NULL DEFAULT 0,
    "quantityUsed" INTEGER NOT NULL DEFAULT 0,
    "quantityReturned" INTEGER NOT NULL DEFAULT 0,
    "inventoryLocation" TEXT,
    "addedBy" TEXT,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "emergencyOrderRequired" BOOLEAN NOT NULL DEFAULT false,
    "orderStatus" TEXT,
    CONSTRAINT "ServiceTicketPart_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ServiceTicketPart_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ServiceTicket"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ServiceTicketPart_ticketId_idx" ON "ServiceTicketPart"("ticketId");
CREATE INDEX IF NOT EXISTS "ServiceTicketPart_partNumber_idx" ON "ServiceTicketPart"("partNumber");

CREATE TABLE IF NOT EXISTS "ServiceTicketAttachment" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "attachmentType" TEXT,
    "fileName" TEXT,
    "fileUrl" TEXT,
    "uploadedBy" TEXT,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "caption" TEXT,
    "visibleToCustomer" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "ServiceTicketAttachment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ServiceTicketAttachment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ServiceTicket"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ServiceTicketAttachment_ticketId_idx" ON "ServiceTicketAttachment"("ticketId");

CREATE TABLE IF NOT EXISTS "ServiceTicketLabor" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "technicianId" TEXT,
    "startTime" DATETIME,
    "endTime" DATETIME,
    "laborMinutes" INTEGER NOT NULL DEFAULT 0,
    "laborType" TEXT,
    "notes" TEXT,
    "billable" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "ServiceTicketLabor_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ServiceTicketLabor_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ServiceTicket"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ServiceTicketLabor_ticketId_idx" ON "ServiceTicketLabor"("ticketId");
CREATE INDEX IF NOT EXISTS "ServiceTicketLabor_technicianId_idx" ON "ServiceTicketLabor"("technicianId");

CREATE TABLE IF NOT EXISTS "DispatchAssignment" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "technicianId" TEXT,
    "assignedBy" TEXT,
    "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" DATETIME,
    "declinedAt" DATETIME,
    "declineReason" TEXT,
    "estimatedArrival" DATETIME,
    "actualArrival" DATETIME,
    "dispatchStatus" TEXT,
    "reassignmentReason" TEXT,
    CONSTRAINT "DispatchAssignment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DispatchAssignment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ServiceTicket"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "DispatchAssignment_ticketId_idx" ON "DispatchAssignment"("ticketId");
CREATE INDEX IF NOT EXISTS "DispatchAssignment_technicianId_idx" ON "DispatchAssignment"("technicianId");
CREATE INDEX IF NOT EXISTS "DispatchAssignment_dispatchStatus_idx" ON "DispatchAssignment"("dispatchStatus");

CREATE TABLE IF NOT EXISTS "TicketNumberSequence" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "lastSeq" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TicketNumberSequence_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "TicketNumberSequence_year_key" ON "TicketNumberSequence"("year");

CREATE TABLE IF NOT EXISTS "ProblemCategoryConfig" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProblemCategoryConfig_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ProblemCategoryConfig_code_key" ON "ProblemCategoryConfig"("code");
CREATE INDEX IF NOT EXISTS "ProblemCategoryConfig_enabled_sortOrder_idx" ON "ProblemCategoryConfig"("enabled", "sortOrder");

CREATE TABLE IF NOT EXISTS "SlaRuleConfig" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "responseMinutes" INTEGER NOT NULL,
    "assignmentMinutes" INTEGER NOT NULL,
    "arrivalMinutes" INTEGER NOT NULL,
    "resolutionMinutes" INTEGER NOT NULL,
    "escalationMinutes" INTEGER NOT NULL,
    "weekendCoverage" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SlaRuleConfig_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SlaRuleConfig_priority_enabled_idx" ON "SlaRuleConfig"("priority", "enabled");
