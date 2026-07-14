-- Patch 46 — PM Workflow & Technician Experience
-- Reversible additive migration (SQLite).

-- MachinePmState: last labor minutes
ALTER TABLE "MachinePmState" ADD COLUMN "lastLaborMinutes" INTEGER;

-- MachinePmHistory: workflow documentation fields
ALTER TABLE "MachinePmHistory" ADD COLUMN "timeStarted" DATETIME;
ALTER TABLE "MachinePmHistory" ADD COLUMN "timeFinished" DATETIME;
ALTER TABLE "MachinePmHistory" ADD COLUMN "laborMinutes" INTEGER;
ALTER TABLE "MachinePmHistory" ADD COLUMN "qualityScore" REAL;
ALTER TABLE "MachinePmHistory" ADD COLUMN "checklistJson" TEXT;
ALTER TABLE "MachinePmHistory" ADD COLUMN "checklistCompletionPct" REAL;
ALTER TABLE "MachinePmHistory" ADD COLUMN "partsUsedJson" TEXT;
ALTER TABLE "MachinePmHistory" ADD COLUMN "statusAtCompletion" TEXT;
ALTER TABLE "MachinePmHistory" ADD COLUMN "workPerformed" TEXT;
ALTER TABLE "MachinePmHistory" ADD COLUMN "customerSignaturePlaceholder" TEXT;

CREATE INDEX IF NOT EXISTS "MachinePmHistory_technician_completedAt_idx"
  ON "MachinePmHistory"("technician", "completedAt");

-- Checklist templates per model
CREATE TABLE IF NOT EXISTS "MachinePmChecklistTemplate" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "printerModel" TEXT NOT NULL,
  "itemKey" TEXT NOT NULL,
  "taskName" TEXT NOT NULL,
  "description" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "required" BOOLEAN NOT NULL DEFAULT true,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "MachinePmChecklistTemplate_printerModel_itemKey_key"
  ON "MachinePmChecklistTemplate"("printerModel", "itemKey");
CREATE INDEX IF NOT EXISTS "MachinePmChecklistTemplate_printerModel_active_sortOrder_idx"
  ON "MachinePmChecklistTemplate"("printerModel", "active", "sortOrder");

-- In-progress drafts
CREATE TABLE IF NOT EXISTS "MachinePmDraft" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "machinePmStateId" TEXT NOT NULL,
  "machineId" TEXT NOT NULL,
  "technician" TEXT NOT NULL,
  "checklistJson" TEXT NOT NULL,
  "partsUsedJson" TEXT,
  "notes" TEXT,
  "timeStarted" DATETIME,
  "meterReading" INTEGER,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MachinePmDraft_machinePmStateId_fkey"
    FOREIGN KEY ("machinePmStateId") REFERENCES "MachinePmState" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "MachinePmDraft_machineId_technician_key"
  ON "MachinePmDraft"("machineId", "technician");
CREATE INDEX IF NOT EXISTS "MachinePmDraft_machineId_idx"
  ON "MachinePmDraft"("machineId");

-- Audit log
CREATE TABLE IF NOT EXISTS "MachinePmAuditLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "machineId" TEXT,
  "user" TEXT,
  "action" TEXT NOT NULL,
  "previousValue" TEXT,
  "newValue" TEXT,
  "details" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "MachinePmAuditLog_machineId_createdAt_idx"
  ON "MachinePmAuditLog"("machineId", "createdAt");
CREATE INDEX IF NOT EXISTS "MachinePmAuditLog_action_createdAt_idx"
  ON "MachinePmAuditLog"("action", "createdAt");
