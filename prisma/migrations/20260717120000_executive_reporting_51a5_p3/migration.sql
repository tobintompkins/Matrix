-- Patch 51A.5 Part 3 — Executive reporting schedules & cache (additive)

CREATE TABLE IF NOT EXISTS "executive_report_schedules" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL DEFAULT 'org-sfx',
  "name" TEXT NOT NULL,
  "period" TEXT NOT NULL,
  "format" TEXT NOT NULL DEFAULT 'CSV',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "recipientsJson" TEXT NOT NULL DEFAULT '[]',
  "createdById" TEXT,
  "createdByName" TEXT,
  "lastRunAt" DATETIME,
  "nextRunAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE INDEX IF NOT EXISTS "executive_report_schedules_organizationId_enabled_idx"
  ON "executive_report_schedules"("organizationId", "enabled");
CREATE INDEX IF NOT EXISTS "executive_report_schedules_nextRunAt_idx"
  ON "executive_report_schedules"("nextRunAt");

CREATE TABLE IF NOT EXISTS "executive_report_cache" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL DEFAULT 'org-sfx',
  "cacheKey" TEXT NOT NULL,
  "payloadJson" TEXT NOT NULL,
  "expiresAt" DATETIME NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "executive_report_cache_organizationId_cacheKey_key"
  ON "executive_report_cache"("organizationId", "cacheKey");
CREATE INDEX IF NOT EXISTS "executive_report_cache_expiresAt_idx"
  ON "executive_report_cache"("expiresAt");
