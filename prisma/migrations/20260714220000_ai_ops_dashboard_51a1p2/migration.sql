-- Patch 51A.1 Part 2 — AI insights + analysis runs

CREATE TABLE IF NOT EXISTS "ai_analysis_runs" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'QUEUED',
  "requestedByUserId" TEXT,
  "startedAt" DATETIME,
  "completedAt" DATETIME,
  "durationMs" INTEGER,
  "recordsAnalyzed" INTEGER NOT NULL DEFAULT 0,
  "recordsSkipped" INTEGER NOT NULL DEFAULT 0,
  "insightsCreated" INTEGER NOT NULL DEFAULT 0,
  "errorSummary" TEXT,
  "analysisVersion" TEXT NOT NULL,
  "rulesVersion" TEXT NOT NULL,
  "cancelRequested" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE INDEX IF NOT EXISTS "ai_analysis_runs_organizationId_createdAt_idx" ON "ai_analysis_runs"("organizationId", "createdAt");
CREATE INDEX IF NOT EXISTS "ai_analysis_runs_status_createdAt_idx" ON "ai_analysis_runs"("status", "createdAt");

CREATE TABLE IF NOT EXISTS "ai_insights" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "analysisRunId" TEXT,
  "insightType" TEXT NOT NULL,
  "sourceModule" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "explanation" TEXT NOT NULL,
  "recommendedAction" TEXT NOT NULL,
  "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
  "confidence" REAL NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'NEW',
  "riskCategory" TEXT NOT NULL DEFAULT 'MONITOR',
  "supportingEvidence" TEXT,
  "limitations" TEXT,
  "analysisVersion" TEXT NOT NULL,
  "customerId" TEXT,
  "customerName" TEXT,
  "siteId" TEXT,
  "siteName" TEXT,
  "machineId" TEXT,
  "machineLabel" TEXT,
  "serviceCallId" TEXT,
  "pmRecordId" TEXT,
  "inventoryItemId" TEXT,
  "partId" TEXT,
  "dataQualityIssueId" TEXT,
  "relatedRecordHref" TEXT,
  "assignedReviewerId" TEXT,
  "assignedReviewerName" TEXT,
  "reviewNotes" TEXT,
  "dismissalReason" TEXT,
  "resolutionSummary" TEXT,
  "actionTaken" TEXT,
  "followUpDate" DATETIME,
  "resolvedAt" DATETIME,
  "archivedAt" DATETIME,
  "acknowledgedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ai_insights_analysisRunId_fkey" FOREIGN KEY ("analysisRunId") REFERENCES "ai_analysis_runs" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ai_insights_organizationId_status_idx" ON "ai_insights"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "ai_insights_organizationId_severity_idx" ON "ai_insights"("organizationId", "severity");
CREATE INDEX IF NOT EXISTS "ai_insights_organizationId_insightType_idx" ON "ai_insights"("organizationId", "insightType");
CREATE INDEX IF NOT EXISTS "ai_insights_organizationId_sourceModule_idx" ON "ai_insights"("organizationId", "sourceModule");
CREATE INDEX IF NOT EXISTS "ai_insights_organizationId_createdAt_idx" ON "ai_insights"("organizationId", "createdAt");
CREATE INDEX IF NOT EXISTS "ai_insights_organizationId_updatedAt_idx" ON "ai_insights"("organizationId", "updatedAt");
CREATE INDEX IF NOT EXISTS "ai_insights_assignedReviewerId_status_idx" ON "ai_insights"("assignedReviewerId", "status");
CREATE INDEX IF NOT EXISTS "ai_insights_customerId_idx" ON "ai_insights"("customerId");
CREATE INDEX IF NOT EXISTS "ai_insights_siteId_idx" ON "ai_insights"("siteId");
CREATE INDEX IF NOT EXISTS "ai_insights_machineId_idx" ON "ai_insights"("machineId");
CREATE INDEX IF NOT EXISTS "ai_insights_serviceCallId_idx" ON "ai_insights"("serviceCallId");
CREATE INDEX IF NOT EXISTS "ai_insights_pmRecordId_idx" ON "ai_insights"("pmRecordId");

CREATE TABLE IF NOT EXISTS "ai_insight_events" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "insightId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "actorName" TEXT,
  "action" TEXT NOT NULL,
  "previousStatus" TEXT,
  "newStatus" TEXT,
  "note" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_insight_events_insightId_fkey" FOREIGN KEY ("insightId") REFERENCES "ai_insights" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ai_insight_events_insightId_createdAt_idx" ON "ai_insight_events"("insightId", "createdAt");
