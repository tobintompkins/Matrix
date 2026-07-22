-- Patch 51A.4 — Enterprise Decision Engine (additive)

CREATE TABLE IF NOT EXISTS "decision_engine_settings" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "scheduledRefreshEnabled" BOOLEAN NOT NULL DEFAULT false,
  "riskWeight" REAL NOT NULL DEFAULT 0.35,
  "urgencyWeight" REAL NOT NULL DEFAULT 0.25,
  "businessImpactWeight" REAL NOT NULL DEFAULT 0.20,
  "slaWeight" REAL NOT NULL DEFAULT 0.10,
  "confidenceWeight" REAL NOT NULL DEFAULT 0.10,
  "highImpactRequiresApproval" BOOLEAN NOT NULL DEFAULT true,
  "autoExpireDays" INTEGER NOT NULL DEFAULT 30,
  "rulesVersion" TEXT NOT NULL DEFAULT 'decision-v1',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "decision_engine_settings_organizationId_key"
  ON "decision_engine_settings"("organizationId");

CREATE TABLE IF NOT EXISTS "decision_recommendations" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL DEFAULT 'org-sfx',
  "decisionType" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "detailedReasoning" TEXT NOT NULL DEFAULT '',
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT,
  "fingerprint" TEXT NOT NULL,
  "customerId" TEXT,
  "siteId" TEXT,
  "machineId" TEXT,
  "serviceCallId" TEXT,
  "preventiveMaintenanceId" TEXT,
  "technicianId" TEXT,
  "partId" TEXT,
  "inventoryLocationId" TEXT,
  "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
  "status" TEXT NOT NULL DEFAULT 'NEW',
  "confidenceScore" REAL NOT NULL DEFAULT 0,
  "riskScore" REAL NOT NULL DEFAULT 0,
  "urgencyScore" REAL NOT NULL DEFAULT 0,
  "businessImpactScore" REAL NOT NULL DEFAULT 0,
  "overallDecisionScore" REAL NOT NULL DEFAULT 0,
  "estimatedDowntimeMinutes" INTEGER,
  "estimatedLaborMinutes" INTEGER,
  "estimatedCost" REAL,
  "estimatedCostAvoidance" REAL,
  "slaImpact" TEXT,
  "recommendedAction" TEXT NOT NULL,
  "alternativeActionsJson" TEXT NOT NULL DEFAULT '[]',
  "evidenceSnapshotJson" TEXT NOT NULL DEFAULT '{}',
  "highImpact" BOOLEAN NOT NULL DEFAULT false,
  "rulesVersion" TEXT NOT NULL DEFAULT 'decision-v1',
  "aiProvider" TEXT,
  "aiModel" TEXT,
  "aiExplanationVersion" TEXT,
  "aiExplanationJson" TEXT,
  "assignedToUserId" TEXT,
  "dueAt" DATETIME,
  "reviewedAt" DATETIME,
  "reviewedBy" TEXT,
  "approvedAt" DATETIME,
  "approvedBy" TEXT,
  "rejectedAt" DATETIME,
  "rejectedBy" TEXT,
  "rejectionReason" TEXT,
  "deferredUntil" DATETIME,
  "completedAt" DATETIME,
  "completedBy" TEXT,
  "completionNotes" TEXT,
  "supersededById" TEXT,
  "usefulRating" INTEGER,
  "outcomeUseful" BOOLEAN,
  "outcomeConfirmed" BOOLEAN,
  "outcomeDowntimeAvoided" BOOLEAN,
  "outcomeActualLaborMinutes" INTEGER,
  "outcomeActualCost" REAL,
  "outcomeFeedbackJson" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE INDEX IF NOT EXISTS "decision_recommendations_organizationId_fingerprint_status_idx"
  ON "decision_recommendations"("organizationId", "fingerprint", "status");
CREATE INDEX IF NOT EXISTS "decision_recommendations_organizationId_status_priority_idx"
  ON "decision_recommendations"("organizationId", "status", "priority");
CREATE INDEX IF NOT EXISTS "decision_recommendations_organizationId_decisionType_createdAt_idx"
  ON "decision_recommendations"("organizationId", "decisionType", "createdAt");
CREATE INDEX IF NOT EXISTS "decision_recommendations_machineId_status_idx"
  ON "decision_recommendations"("machineId", "status");
CREATE INDEX IF NOT EXISTS "decision_recommendations_assignedToUserId_status_idx"
  ON "decision_recommendations"("assignedToUserId", "status");
CREATE INDEX IF NOT EXISTS "decision_recommendations_dueAt_idx"
  ON "decision_recommendations"("dueAt");
CREATE INDEX IF NOT EXISTS "decision_recommendations_overallDecisionScore_idx"
  ON "decision_recommendations"("overallDecisionScore");

CREATE TABLE IF NOT EXISTS "decision_history_events" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL DEFAULT 'org-sfx',
  "decisionId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "fromStatus" TEXT,
  "toStatus" TEXT,
  "actorUserId" TEXT,
  "actorName" TEXT,
  "reason" TEXT,
  "notes" TEXT,
  "metadataJson" TEXT NOT NULL DEFAULT '{}',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "decision_history_events_decisionId_fkey"
    FOREIGN KEY ("decisionId") REFERENCES "decision_recommendations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "decision_history_events_decisionId_createdAt_idx"
  ON "decision_history_events"("decisionId", "createdAt");
CREATE INDEX IF NOT EXISTS "decision_history_events_organizationId_createdAt_idx"
  ON "decision_history_events"("organizationId", "createdAt");
