-- Patch 40: Enterprise Customer, Site & Asset Management

-- Customer CRM fields + hierarchy
ALTER TABLE "Customer" ADD COLUMN "customerNumber" TEXT;
ALTER TABLE "Customer" ADD COLUMN "industry" TEXT;
ALTER TABLE "Customer" ADD COLUMN "parentCustomerId" TEXT;
ALTER TABLE "Customer" ADD COLUMN "taxId" TEXT;
ALTER TABLE "Customer" ADD COLUMN "billingAddress" TEXT;
ALTER TABLE "Customer" ADD COLUMN "primaryAddress" TEXT;
ALTER TABLE "Customer" ADD COLUMN "notes" TEXT;
ALTER TABLE "Customer" ADD COLUMN "website" TEXT;
ALTER TABLE "Customer" ADD COLUMN "timeZone" TEXT;
ALTER TABLE "Customer" ADD COLUMN "preferredBusinessHours" TEXT;
CREATE INDEX IF NOT EXISTS "Customer_customerNumber_idx" ON "Customer"("customerNumber");
CREATE INDEX IF NOT EXISTS "Customer_parentCustomerId_idx" ON "Customer"("parentCustomerId");
CREATE INDEX IF NOT EXISTS "Customer_status_idx" ON "Customer"("status");

-- Site / Location enrichment
ALTER TABLE "Location" ADD COLUMN "siteNumber" TEXT;
ALTER TABLE "Location" ADD COLUMN "postalCode" TEXT;
ALTER TABLE "Location" ADD COLUMN "country" TEXT;
ALTER TABLE "Location" ADD COLUMN "latitude" REAL;
ALTER TABLE "Location" ADD COLUMN "longitude" REAL;
ALTER TABLE "Location" ADD COLUMN "businessHours" TEXT;
ALTER TABLE "Location" ADD COLUMN "loadingDockInstructions" TEXT;
ALTER TABLE "Location" ADD COLUMN "parkingInstructions" TEXT;
ALTER TABLE "Location" ADD COLUMN "securityProcedures" TEXT;
ALTER TABLE "Location" ADD COLUMN "buildingAccessInstructions" TEXT;
ALTER TABLE "Location" ADD COLUMN "afterHoursAccess" TEXT;
ALTER TABLE "Location" ADD COLUMN "siteNotes" TEXT;
ALTER TABLE "Location" ADD COLUMN "assignedTechnician" TEXT;
CREATE INDEX IF NOT EXISTS "Location_siteNumber_idx" ON "Location"("siteNumber");

-- Printer / asset enrichment
ALTER TABLE "Printer" ADD COLUMN "controllerVersion" TEXT;
ALTER TABLE "Printer" ADD COLUMN "warrantyStart" DATETIME;
ALTER TABLE "Printer" ADD COLUMN "warrantyEnd" DATETIME;
ALTER TABLE "Printer" ADD COLUMN "purchaseDate" DATETIME;
ALTER TABLE "Printer" ADD COLUMN "leaseInfo" TEXT;
ALTER TABLE "Printer" ADD COLUMN "ownership" TEXT;
ALTER TABLE "Printer" ADD COLUMN "macAddress" TEXT;
ALTER TABLE "Printer" ADD COLUMN "ipAddress" TEXT;
ALTER TABLE "Printer" ADD COLUMN "hostname" TEXT;
ALTER TABLE "Printer" ADD COLUMN "department" TEXT;
ALTER TABLE "Printer" ADD COLUMN "floor" TEXT;
ALTER TABLE "Printer" ADD COLUMN "room" TEXT;
ALTER TABLE "Printer" ADD COLUMN "latitude" REAL;
ALTER TABLE "Printer" ADD COLUMN "longitude" REAL;
ALTER TABLE "Printer" ADD COLUMN "qrLabel" TEXT;
ALTER TABLE "Printer" ADD COLUMN "barcode" TEXT;
CREATE INDEX IF NOT EXISTS "Printer_qrLabel_idx" ON "Printer"("qrLabel");
CREATE INDEX IF NOT EXISTS "Printer_barcode_idx" ON "Printer"("barcode");
CREATE INDEX IF NOT EXISTS "Printer_ipAddress_idx" ON "Printer"("ipAddress");
CREATE INDEX IF NOT EXISTS "Printer_hostname_idx" ON "Printer"("hostname");

CREATE TABLE IF NOT EXISTS "CustomerContact" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "jobTitle" TEXT,
    "department" TEXT,
    "email" TEXT,
    "officePhone" TEXT,
    "mobilePhone" TEXT,
    "preferredContactMethod" TEXT,
    "emergencyContact" BOOLEAN NOT NULL DEFAULT false,
    "receiveServiceNotifications" BOOLEAN NOT NULL DEFAULT true,
    "receiveMaintenanceReports" BOOLEAN NOT NULL DEFAULT false,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CustomerContact_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CustomerContact_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "CustomerContact_customerId_idx" ON "CustomerContact"("customerId");
CREATE INDEX IF NOT EXISTS "CustomerContact_email_idx" ON "CustomerContact"("email");
CREATE INDEX IF NOT EXISTS "CustomerContact_name_idx" ON "CustomerContact"("name");

CREATE TABLE IF NOT EXISTS "CustomerContract" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "contractNumber" TEXT NOT NULL,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "renewalDate" DATETIME,
    "slaResponseHours" INTEGER,
    "slaResolutionHours" INTEGER,
    "includedPMs" INTEGER,
    "includedLaborHours" INTEGER,
    "includedParts" BOOLEAN NOT NULL DEFAULT false,
    "excludedServices" TEXT,
    "billingType" TEXT,
    "status" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CustomerContract_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CustomerContract_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerContract_contractNumber_key" ON "CustomerContract"("contractNumber");
CREATE INDEX IF NOT EXISTS "CustomerContract_customerId_idx" ON "CustomerContract"("customerId");
CREATE INDEX IF NOT EXISTS "CustomerContract_endDate_idx" ON "CustomerContract"("endDate");
CREATE INDEX IF NOT EXISTS "CustomerContract_status_idx" ON "CustomerContract"("status");

CREATE TABLE IF NOT EXISTS "AssetWarranty" (
    "id" TEXT NOT NULL,
    "printerId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "coveredComponents" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AssetWarranty_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AssetWarranty_printerId_fkey" FOREIGN KEY ("printerId") REFERENCES "Printer"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "AssetWarranty_printerId_idx" ON "AssetWarranty"("printerId");
CREATE INDEX IF NOT EXISTS "AssetWarranty_endDate_idx" ON "AssetWarranty"("endDate");
CREATE INDEX IF NOT EXISTS "AssetWarranty_status_idx" ON "AssetWarranty"("status");

CREATE TABLE IF NOT EXISTS "AssetLifecycleEvent" (
    "id" TEXT NOT NULL,
    "printerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "occurredAt" DATETIME NOT NULL,
    "actor" TEXT,
    "summary" TEXT,
    "details" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssetLifecycleEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AssetLifecycleEvent_printerId_fkey" FOREIGN KEY ("printerId") REFERENCES "Printer"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "AssetLifecycleEvent_printerId_occurredAt_idx" ON "AssetLifecycleEvent"("printerId", "occurredAt");
CREATE INDEX IF NOT EXISTS "AssetLifecycleEvent_type_idx" ON "AssetLifecycleEvent"("type");

CREATE TABLE IF NOT EXISTS "AssetRelationship" (
    "id" TEXT NOT NULL,
    "parentPrinterId" TEXT NOT NULL,
    "childPrinterId" TEXT,
    "childName" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "serialNumber" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AssetRelationship_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AssetRelationship_parentPrinterId_fkey" FOREIGN KEY ("parentPrinterId") REFERENCES "Printer"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AssetRelationship_childPrinterId_fkey" FOREIGN KEY ("childPrinterId") REFERENCES "Printer"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "AssetRelationship_parentPrinterId_idx" ON "AssetRelationship"("parentPrinterId");
CREATE INDEX IF NOT EXISTS "AssetRelationship_childPrinterId_idx" ON "AssetRelationship"("childPrinterId");
CREATE INDEX IF NOT EXISTS "AssetRelationship_kind_idx" ON "AssetRelationship"("kind");

CREATE TABLE IF NOT EXISTS "CustomerDocument" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "siteId" TEXT,
    "printerId" TEXT,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fileName" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedBy" TEXT,
    "storageRef" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CustomerDocument_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CustomerDocument_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "CustomerDocument_customerId_idx" ON "CustomerDocument"("customerId");
CREATE INDEX IF NOT EXISTS "CustomerDocument_siteId_idx" ON "CustomerDocument"("siteId");
CREATE INDEX IF NOT EXISTS "CustomerDocument_printerId_idx" ON "CustomerDocument"("printerId");
CREATE INDEX IF NOT EXISTS "CustomerDocument_category_idx" ON "CustomerDocument"("category");

CREATE TABLE IF NOT EXISTS "CrmAuditEntry" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "previousValue" TEXT,
    "newValue" TEXT,
    "actor" TEXT,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CrmAuditEntry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CrmAuditEntry_entityType_entityId_idx" ON "CrmAuditEntry"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "CrmAuditEntry_occurredAt_idx" ON "CrmAuditEntry"("occurredAt");
