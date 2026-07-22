-- Patch 51A.5 Part 3 Completion — alerts, configs, history, schedule fields

CREATE TABLE IF NOT EXISTS "executive_report_configs" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL DEFAULT 'org-sfx',
  "name" TEXT NOT NULL,
  "period" TEXT NOT NULL DEFAULT 'WEEKLY',
  "format" TEXT NOT NULL DEFAULT 'CSV',
  "filtersJson" TEXT NOT NULL DEFAULT '{}',
  "sectionsJson" TEXT NOT NULL DEFAULT '[]',
  "createdById" TEXT,
  "createdByName" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE INDEX IF NOT EXISTS "executive_report_configs_organizationId_updatedAt_idx"
  ON "executive_report_configs"("organizationId", "updatedAt");

CREATE TABLE IF NOT EXISTS "executive_report_history" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL DEFAULT 'org-sfx',
  "period" TEXT NOT NULL,
  "format" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "filtersJson" TEXT NOT NULL DEFAULT '{}',
  "summaryJson" TEXT NOT NULL DEFAULT '{}',
  "filename" TEXT,
  "createdById" TEXT,
  "createdByName" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "executive_report_history_organizationId_createdAt_idx"
  ON "executive_report_history"("organizationId", "createdAt");

CREATE TABLE IF NOT EXISTS "executive_alerts" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL DEFAULT 'org-sfx',
  "alertKey" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "explanation" TEXT NOT NULL,
  "entityType" TEXT,
  "entityId" TEXT,
  "entityLabel" TEXT,
  "href" TEXT,
  "recommendedAction" TEXT,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "ownerId" TEXT,
  "ownerName" TEXT,
  "sourceType" TEXT,
  "sourceRecordId" TEXT,
  "detectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acknowledgedAt" DATETIME,
  "acknowledgedByUserId" TEXT,
  "resolvedAt" DATETIME,
  "resolvedByUserId" TEXT,
  "resolutionNote" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE INDEX IF NOT EXISTS "executive_alerts_organizationId_alertKey_status_idx"
  ON "executive_alerts"("organizationId", "alertKey", "status");
CREATE INDEX IF NOT EXISTS "executive_alerts_organizationId_status_severity_idx"
  ON "executive_alerts"("organizationId", "status", "severity");
CREATE INDEX IF NOT EXISTS "executive_alerts_organizationId_category_idx"
  ON "executive_alerts"("organizationId", "category");
CREATE INDEX IF NOT EXISTS "executive_alerts_detectedAt_idx"
  ON "executive_alerts"("detectedAt");
