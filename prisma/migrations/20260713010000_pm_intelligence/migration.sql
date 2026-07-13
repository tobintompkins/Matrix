-- Patch 44: PM Intelligence, Meter Counts & Cleaning Management
-- Additive models — preserves existing maintenance / printer data.

CREATE TABLE IF NOT EXISTS "PmMeterReading" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "printerId" TEXT NOT NULL,
    "meterCount" INTEGER NOT NULL,
    "previousCount" INTEGER,
    "countIncrease" INTEGER,
    "recordedAt" DATETIME NOT NULL,
    "countTime" TEXT,
    "operatingHours" REAL,
    "colorCount" INTEGER,
    "blackCount" INTEGER,
    "duplexCount" INTEGER,
    "scanCount" INTEGER,
    "notes" TEXT,
    "source" TEXT NOT NULL,
    "enteredBy" TEXT,
    "photoUrl" TEXT,
    "validationOverrideReason" TEXT,
    "suspectedReset" BOOLEAN NOT NULL DEFAULT false,
    "unusualIncrease" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "PmMeterReading_printerId_recordedAt_idx" ON "PmMeterReading"("printerId", "recordedAt");

CREATE TABLE IF NOT EXISTS "PmMeterImport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fileName" TEXT NOT NULL,
    "importedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "importedBy" TEXT,
    "totalRows" INTEGER NOT NULL,
    "successCount" INTEGER NOT NULL,
    "errorCount" INTEGER NOT NULL,
    "errorsJson" TEXT
);

CREATE TABLE IF NOT EXISTS "PmIntervalRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "printerModel" TEXT NOT NULL,
    "maintenanceType" TEXT NOT NULL,
    "startingMeter" INTEGER NOT NULL DEFAULT 0,
    "intervalCount" INTEGER NOT NULL,
    "warningThreshold" INTEGER NOT NULL,
    "criticalThreshold" INTEGER NOT NULL,
    "graceThreshold" INTEGER NOT NULL,
    "dateBasedIntervalDays" INTEGER,
    "requiredPartsKitId" TEXT,
    "estimatedLaborHours" REAL NOT NULL DEFAULT 2,
    "instructions" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE INDEX IF NOT EXISTS "PmIntervalRule_printerModel_idx" ON "PmIntervalRule"("printerModel");

CREATE TABLE IF NOT EXISTS "PmCleaningIntervalRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cleaningType" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "printerModel" TEXT,
    "impressionInterval" INTEGER,
    "calendarIntervalDays" INTEGER,
    "operatingHoursInterval" INTEGER,
    "warningThreshold" INTEGER NOT NULL DEFAULT 50000,
    "active" BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS "PmCleaningCompletion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "printerId" TEXT NOT NULL,
    "cleaningType" TEXT NOT NULL,
    "completedAt" DATETIME NOT NULL,
    "completedMeter" INTEGER NOT NULL,
    "technician" TEXT,
    "timeSpentMinutes" INTEGER,
    "conditionBefore" TEXT,
    "conditionAfter" TEXT,
    "suppliesUsedJson" TEXT,
    "partsUsedJson" TEXT,
    "photosJson" TEXT,
    "notes" TEXT,
    "customerSignature" TEXT,
    "followUpRequired" BOOLEAN NOT NULL DEFAULT false,
    "nextCleaningCount" INTEGER,
    "nextCleaningDate" DATETIME
);

CREATE INDEX IF NOT EXISTS "PmCleaningCompletion_printerId_idx" ON "PmCleaningCompletion"("printerId");

CREATE TABLE IF NOT EXISTS "PmPartsKit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "printerModel" TEXT NOT NULL,
    "requiredPartsJson" TEXT,
    "recommendedPartsJson" TEXT,
    "consumablesJson" TEXT,
    "estimatedLaborHours" REAL NOT NULL DEFAULT 2
);

CREATE TABLE IF NOT EXISTS "PmCompletionSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "printerId" TEXT NOT NULL,
    "scheduleId" TEXT,
    "step" INTEGER NOT NULL DEFAULT 1,
    "startingMeter" INTEGER,
    "endingMeter" INTEGER,
    "checklistJson" TEXT,
    "partsUsedJson" TEXT,
    "cleaningTypesJson" TEXT,
    "notes" TEXT,
    "photosJson" TEXT,
    "technician" TEXT,
    "customerAck" TEXT,
    "status" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "completedAt" DATETIME
);

CREATE TABLE IF NOT EXISTS "PmMachineHealthScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "printerId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "factorsJson" TEXT,
    "calculatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "PmMachineHealthScore_printerId_idx" ON "PmMachineHealthScore"("printerId");

CREATE TABLE IF NOT EXISTS "PmIntelligenceAudit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user" TEXT,
    "action" TEXT NOT NULL,
    "printerId" TEXT,
    "customerName" TEXT,
    "previousValue" TEXT,
    "newValue" TEXT,
    "reason" TEXT,
    "sourceModule" TEXT,
    "device" TEXT,
    "ipAddress" TEXT,
    "workOrderId" TEXT,
    "pmEventId" TEXT
);

CREATE INDEX IF NOT EXISTS "PmIntelligenceAudit_printerId_timestamp_idx" ON "PmIntelligenceAudit"("printerId", "timestamp");
CREATE INDEX IF NOT EXISTS "PmIntelligenceAudit_action_idx" ON "PmIntelligenceAudit"("action");

CREATE TABLE IF NOT EXISTS "PmSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "countFreshnessDays" INTEGER NOT NULL DEFAULT 30,
    "unusualIncreaseMultiplier" REAL NOT NULL DEFAULT 3,
    "healthWeightsJson" TEXT,
    "defaultWarningThreshold" INTEGER NOT NULL DEFAULT 75000,
    "defaultCriticalThreshold" INTEGER NOT NULL DEFAULT 25000,
    "defaultGraceThreshold" INTEGER NOT NULL DEFAULT 10000,
    "customerNotificationsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL,
    "updatedBy" TEXT
);
