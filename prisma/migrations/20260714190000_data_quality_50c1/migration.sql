-- Patch 50C-1 — Data Quality Center

CREATE TABLE IF NOT EXISTS "DataQualitySetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "settingsJson" TEXT NOT NULL,
    "updatedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "DataQualitySetting_organizationId_key"
  ON "DataQualitySetting"("organizationId");

CREATE TABLE IF NOT EXISTS "DataQualityRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "ruleType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT 1,
    "isSystemRule" BOOLEAN NOT NULL DEFAULT 0,
    "configurationJson" TEXT,
    "remediationConfiguration" TEXT,
    "schedule" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "DataQualityRule_organizationId_code_key"
  ON "DataQualityRule"("organizationId", "code");
CREATE INDEX IF NOT EXISTS "DataQualityRule_organizationId_module_isActive_idx"
  ON "DataQualityRule"("organizationId", "module", "isActive");

CREATE TABLE IF NOT EXISTS "DataQualityScan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "scanType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "modulesJson" TEXT,
    "requestedByUserId" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "recordsScanned" INTEGER,
    "issuesFound" INTEGER,
    "criticalIssuesFound" INTEGER,
    "errorsJson" TEXT,
    "calculationVersion" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE INDEX IF NOT EXISTS "DataQualityScan_organizationId_createdAt_idx"
  ON "DataQualityScan"("organizationId", "createdAt");
CREATE INDEX IF NOT EXISTS "DataQualityScan_organizationId_status_idx"
  ON "DataQualityScan"("organizationId", "status");

CREATE TABLE IF NOT EXISTS "DataQualityIssue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "issueKey" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "secondaryEntityId" TEXT,
    "issueType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "fieldName" TEXT,
    "currentValue" TEXT,
    "expectedValue" TEXT,
    "evidence" TEXT,
    "confidenceScore" REAL,
    "ruleId" TEXT,
    "scanId" TEXT,
    "assignedToUserId" TEXT,
    "assignedByUserId" TEXT,
    "detectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" DATETIME,
    "firstDetectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastDetectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" DATETIME,
    "resolvedAt" DATETIME,
    "resolvedByUserId" TEXT,
    "resolutionMethod" TEXT,
    "resolutionNote" TEXT,
    "dismissedAt" DATETIME,
    "dismissedByUserId" TEXT,
    "dismissalReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE INDEX IF NOT EXISTS "DataQualityIssue_organizationId_status_idx"
  ON "DataQualityIssue"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "DataQualityIssue_organizationId_severity_idx"
  ON "DataQualityIssue"("organizationId", "severity");
CREATE INDEX IF NOT EXISTS "DataQualityIssue_organizationId_issueKey_status_idx"
  ON "DataQualityIssue"("organizationId", "issueKey", "status");
CREATE INDEX IF NOT EXISTS "DataQualityIssue_entityType_entityId_idx"
  ON "DataQualityIssue"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "DataQualityIssue_ruleId_status_idx"
  ON "DataQualityIssue"("ruleId", "status");
CREATE INDEX IF NOT EXISTS "DataQualityIssue_assignedToUserId_status_idx"
  ON "DataQualityIssue"("assignedToUserId", "status");
CREATE INDEX IF NOT EXISTS "DataQualityIssue_firstDetectedAt_idx"
  ON "DataQualityIssue"("firstDetectedAt");
CREATE INDEX IF NOT EXISTS "DataQualityIssue_scanId_idx"
  ON "DataQualityIssue"("scanId");

CREATE TABLE IF NOT EXISTS "DataMergeHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "masterRecordId" TEXT NOT NULL,
    "mergedRecordId" TEXT NOT NULL,
    "fieldSelectionsJson" TEXT,
    "relationshipSummaryJson" TEXT,
    "performedByUserId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "performedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rollbackStatus" TEXT NOT NULL DEFAULT 'NOT_SUPPORTED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "DataMergeHistory_organizationId_entityType_performedAt_idx"
  ON "DataMergeHistory"("organizationId", "entityType", "performedAt");

CREATE TABLE IF NOT EXISTS "DataQualitySnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "snapshotDate" DATETIME NOT NULL,
    "overallScore" REAL,
    "classification" TEXT,
    "moduleScoresJson" TEXT,
    "issueCountsJson" TEXT,
    "calculationVersion" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "DataQualitySnapshot_organizationId_snapshotDate_key"
  ON "DataQualitySnapshot"("organizationId", "snapshotDate");
CREATE INDEX IF NOT EXISTS "DataQualitySnapshot_organizationId_snapshotDate_idx"
  ON "DataQualitySnapshot"("organizationId", "snapshotDate");
