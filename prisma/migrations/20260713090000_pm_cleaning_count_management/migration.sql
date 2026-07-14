-- Patch 45: PM / Cleaning Count Management
-- Additive ALTER / CREATE matching prisma/schema.prisma (SQLite).
-- Rollback (manual): DROP MachinePm* tables; rebuild Printer / MaintenanceCompletion to drop columns.

-- -----------------------------------------------------------------------------
-- Printer — per-machine interval overrides
-- -----------------------------------------------------------------------------
ALTER TABLE "Printer" ADD COLUMN "pmIntervalOverride" INTEGER;
ALTER TABLE "Printer" ADD COLUMN "cleaningIntervalOverride" INTEGER;
ALTER TABLE "Printer" ADD COLUMN "jointUnitIntervalOverride" INTEGER;
ALTER TABLE "Printer" ADD COLUMN "dtfPmIntervalOverride" INTEGER;
ALTER TABLE "Printer" ADD COLUMN "dueSoonThresholdOverride" INTEGER;

-- -----------------------------------------------------------------------------
-- MaintenanceCompletion — ensure base table exists, then add Patch 45 columns
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "MaintenanceCompletion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "printerId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "completedAt" DATETIME NOT NULL,
    "copyCountAtCompletion" INTEGER NOT NULL,
    "technician" TEXT,
    "notes" TEXT,
    "workPerformed" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MaintenanceCompletion_printerId_fkey" FOREIGN KEY ("printerId") REFERENCES "Printer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "MaintenanceCompletion_printerId_completedAt_idx" ON "MaintenanceCompletion"("printerId", "completedAt");

ALTER TABLE "MaintenanceCompletion" ADD COLUMN "previousCount" INTEGER;
ALTER TABLE "MaintenanceCompletion" ADD COLUMN "intervalAtCompletion" INTEGER;
ALTER TABLE "MaintenanceCompletion" ADD COLUMN "recordedBy" TEXT;
ALTER TABLE "MaintenanceCompletion" ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "MaintenanceCompletion_idempotencyKey_key" ON "MaintenanceCompletion"("idempotencyKey");

-- -----------------------------------------------------------------------------
-- MachinePmState — denormalized fleet PM rows keyed by Digital Twin machineId
-- -----------------------------------------------------------------------------
CREATE TABLE "MachinePmState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "machineId" TEXT NOT NULL,
    "assetTag" TEXT,
    "nickname" TEXT,
    "printerModel" TEXT,
    "customerName" TEXT,
    "siteName" TEXT,
    "assignedTechnician" TEXT,
    "currentMeterCount" INTEGER,
    "lastPmCount" INTEGER,
    "lastPmAt" DATETIME,
    "lastPmTechnician" TEXT,
    "pmInterval" INTEGER,
    "dueSoonThreshold" INTEGER,
    "nextPmDueCount" INTEGER,
    "modelDefaultInterval" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "printerId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "MachinePmState_machineId_key" ON "MachinePmState"("machineId");
CREATE INDEX "MachinePmState_active_printerModel_idx" ON "MachinePmState"("active", "printerModel");
CREATE INDEX "MachinePmState_customerName_idx" ON "MachinePmState"("customerName");
CREATE INDEX "MachinePmState_assignedTechnician_idx" ON "MachinePmState"("assignedTechnician");

-- -----------------------------------------------------------------------------
-- MachinePmHistory
-- -----------------------------------------------------------------------------
CREATE TABLE "MachinePmHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "machinePmStateId" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "completedAt" DATETIME NOT NULL,
    "countAtCompletion" INTEGER NOT NULL,
    "previousPmCount" INTEGER,
    "pmIntervalAtCompletion" INTEGER NOT NULL,
    "technician" TEXT NOT NULL,
    "recordedBy" TEXT,
    "notes" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MachinePmHistory_machinePmStateId_fkey" FOREIGN KEY ("machinePmStateId") REFERENCES "MachinePmState" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "MachinePmHistory_idempotencyKey_key" ON "MachinePmHistory"("idempotencyKey");
CREATE INDEX "MachinePmHistory_machineId_completedAt_idx" ON "MachinePmHistory"("machineId", "completedAt");
CREATE INDEX "MachinePmHistory_machinePmStateId_completedAt_idx" ON "MachinePmHistory"("machinePmStateId", "completedAt");

-- -----------------------------------------------------------------------------
-- MachinePmMeterEntry
-- -----------------------------------------------------------------------------
CREATE TABLE "MachinePmMeterEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "machineId" TEXT NOT NULL,
    "meterCount" INTEGER NOT NULL,
    "previousCount" INTEGER,
    "enteredBy" TEXT NOT NULL,
    "notes" TEXT,
    "lowerCountReason" TEXT,
    "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idempotencyKey" TEXT
);

CREATE UNIQUE INDEX "MachinePmMeterEntry_idempotencyKey_key" ON "MachinePmMeterEntry"("idempotencyKey");
CREATE INDEX "MachinePmMeterEntry_machineId_recordedAt_idx" ON "MachinePmMeterEntry"("machineId", "recordedAt");
