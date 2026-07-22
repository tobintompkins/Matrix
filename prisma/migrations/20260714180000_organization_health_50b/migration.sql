-- Patch 50B — Organization Health

CREATE TABLE IF NOT EXISTS "OrganizationHealthSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "settingsJson" TEXT NOT NULL,
    "updatedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "OrganizationHealthSetting_organizationId_key"
  ON "OrganizationHealthSetting"("organizationId");

CREATE TABLE IF NOT EXISTS "OrganizationHealthSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "snapshotDate" DATETIME NOT NULL,
    "overallScore" REAL,
    "classification" TEXT,
    "fleetScore" REAL,
    "serviceScore" REAL,
    "pmScore" REAL,
    "inventoryScore" REAL,
    "technicianScore" REAL,
    "customerScore" REAL,
    "financialScore" REAL,
    "securityScore" REAL,
    "metricSummary" TEXT,
    "calculationVersion" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "OrganizationHealthSnapshot_organizationId_snapshotDate_key"
  ON "OrganizationHealthSnapshot"("organizationId", "snapshotDate");
CREATE INDEX IF NOT EXISTS "OrganizationHealthSnapshot_organizationId_snapshotDate_idx"
  ON "OrganizationHealthSnapshot"("organizationId", "snapshotDate");

CREATE TABLE IF NOT EXISTS "OrganizationHealthAlert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "alertKey" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "evidence" TEXT,
    "sourceType" TEXT,
    "sourceRecordId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "assignedUserId" TEXT,
    "detectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" DATETIME,
    "acknowledgedAt" DATETIME,
    "acknowledgedByUserId" TEXT,
    "resolvedAt" DATETIME,
    "resolvedByUserId" TEXT,
    "resolutionNote" TEXT,
    "dismissedAt" DATETIME,
    "dismissedByUserId" TEXT,
    "recommendedAction" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE INDEX IF NOT EXISTS "OrganizationHealthAlert_organizationId_status_idx"
  ON "OrganizationHealthAlert"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "OrganizationHealthAlert_organizationId_severity_idx"
  ON "OrganizationHealthAlert"("organizationId", "severity");
CREATE INDEX IF NOT EXISTS "OrganizationHealthAlert_organizationId_category_idx"
  ON "OrganizationHealthAlert"("organizationId", "category");
CREATE INDEX IF NOT EXISTS "OrganizationHealthAlert_organizationId_alertKey_status_idx"
  ON "OrganizationHealthAlert"("organizationId", "alertKey", "status");
CREATE INDEX IF NOT EXISTS "OrganizationHealthAlert_assignedUserId_idx"
  ON "OrganizationHealthAlert"("assignedUserId");
CREATE INDEX IF NOT EXISTS "OrganizationHealthAlert_detectedAt_idx"
  ON "OrganizationHealthAlert"("detectedAt");
