-- Patch 51A.3 — Predictive Maintenance Intelligence (additive)

CREATE TABLE IF NOT EXISTS "predictive_maintenance_runs" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL DEFAULT 'org-sfx',
  "runType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'QUEUED',
  "scopeJson" TEXT NOT NULL DEFAULT '{}',
  "machinesEvaluated" INTEGER NOT NULL DEFAULT 0,
  "recommendationsCreated" INTEGER NOT NULL DEFAULT 0,
  "alertsCreated" INTEGER NOT NULL DEFAULT 0,
  "errorsCount" INTEGER NOT NULL DEFAULT 0,
  "scoringVersion" TEXT NOT NULL,
  "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" DATETIME,
  "initiatedById" TEXT,
  "errorJson" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE INDEX IF NOT EXISTS "predictive_maintenance_runs_organizationId_startedAt_idx"
  ON "predictive_maintenance_runs"("organizationId", "startedAt");
CREATE INDEX IF NOT EXISTS "predictive_maintenance_runs_status_startedAt_idx"
  ON "predictive_maintenance_runs"("status", "startedAt");

CREATE TABLE IF NOT EXISTS "machine_health_snapshots" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL DEFAULT 'org-sfx',
  "machineId" TEXT NOT NULL,
  "healthScore" REAL NOT NULL,
  "riskLevel" TEXT NOT NULL,
  "failureRiskScore" REAL NOT NULL DEFAULT 0,
  "pmUrgencyScore" REAL NOT NULL DEFAULT 0,
  "usageStressScore" REAL NOT NULL DEFAULT 0,
  "repeatIssueScore" REAL NOT NULL DEFAULT 0,
  "downtimeRiskScore" REAL NOT NULL DEFAULT 0,
  "dataQualityScore" REAL NOT NULL DEFAULT 0,
  "confidenceScore" REAL NOT NULL DEFAULT 0,
  "predictedMaintenanceDate" DATETIME,
  "predictedMaintenanceWindowStart" DATETIME,
  "predictedMaintenanceWindowEnd" DATETIME,
  "primaryRiskReason" TEXT,
  "riskFactorsJson" TEXT NOT NULL DEFAULT '[]',
  "recommendationsJson" TEXT NOT NULL DEFAULT '[]',
  "inputSummaryJson" TEXT NOT NULL DEFAULT '{}',
  "scoringVersion" TEXT NOT NULL,
  "aiExplanationVersion" TEXT,
  "aiExplanationJson" TEXT,
  "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "runId" TEXT,
  CONSTRAINT "machine_health_snapshots_runId_fkey"
    FOREIGN KEY ("runId") REFERENCES "predictive_maintenance_runs"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "machine_health_snapshots_machineId_generatedAt_idx"
  ON "machine_health_snapshots"("machineId", "generatedAt");
CREATE INDEX IF NOT EXISTS "machine_health_snapshots_organizationId_riskLevel_idx"
  ON "machine_health_snapshots"("organizationId", "riskLevel");
CREATE INDEX IF NOT EXISTS "machine_health_snapshots_generatedAt_idx"
  ON "machine_health_snapshots"("generatedAt");
CREATE INDEX IF NOT EXISTS "machine_health_snapshots_predictedMaintenanceDate_idx"
  ON "machine_health_snapshots"("predictedMaintenanceDate");

CREATE TABLE IF NOT EXISTS "predictive_maintenance_recommendations" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL DEFAULT 'org-sfx',
  "machineId" TEXT NOT NULL,
  "healthSnapshotId" TEXT NOT NULL,
  "recommendationType" TEXT NOT NULL,
  "priority" TEXT NOT NULL DEFAULT 'NORMAL',
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "confidenceScore" REAL NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "assignedUserId" TEXT,
  "acknowledgedById" TEXT,
  "acknowledgedAt" DATETIME,
  "dismissedById" TEXT,
  "dismissedAt" DATETIME,
  "dismissalReason" TEXT,
  "completedAt" DATETIME,
  "relatedEntityType" TEXT,
  "relatedEntityId" TEXT,
  "dedupeKey" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "predictive_maintenance_recommendations_healthSnapshotId_fkey"
    FOREIGN KEY ("healthSnapshotId") REFERENCES "machine_health_snapshots"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "predictive_maintenance_recommendations_organizationId_status_priority_idx"
  ON "predictive_maintenance_recommendations"("organizationId", "status", "priority");
CREATE INDEX IF NOT EXISTS "predictive_maintenance_recommendations_machineId_status_idx"
  ON "predictive_maintenance_recommendations"("machineId", "status");
CREATE INDEX IF NOT EXISTS "predictive_maintenance_recommendations_healthSnapshotId_idx"
  ON "predictive_maintenance_recommendations"("healthSnapshotId");
CREATE INDEX IF NOT EXISTS "predictive_maintenance_recommendations_dedupeKey_status_idx"
  ON "predictive_maintenance_recommendations"("dedupeKey", "status");

CREATE TABLE IF NOT EXISTS "predictive_risk_alerts" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL DEFAULT 'org-sfx',
  "machineId" TEXT NOT NULL,
  "healthSnapshotId" TEXT,
  "alertType" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "dedupeKey" TEXT NOT NULL,
  "openedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acknowledgedById" TEXT,
  "acknowledgedAt" DATETIME,
  "resolvedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "predictive_risk_alerts_healthSnapshotId_fkey"
    FOREIGN KEY ("healthSnapshotId") REFERENCES "machine_health_snapshots"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "predictive_risk_alerts_organizationId_dedupeKey_status_idx"
  ON "predictive_risk_alerts"("organizationId", "dedupeKey", "status");
CREATE INDEX IF NOT EXISTS "predictive_risk_alerts_organizationId_status_severity_idx"
  ON "predictive_risk_alerts"("organizationId", "status", "severity");
CREATE INDEX IF NOT EXISTS "predictive_risk_alerts_machineId_status_idx"
  ON "predictive_risk_alerts"("machineId", "status");

CREATE TABLE IF NOT EXISTS "predictive_maintenance_settings" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "scheduledEvaluationEnabled" BOOLEAN NOT NULL DEFAULT false,
  "evaluationFrequency" TEXT NOT NULL DEFAULT 'daily',
  "healthScoreWarningThreshold" REAL NOT NULL DEFAULT 70,
  "healthScoreCriticalThreshold" REAL NOT NULL DEFAULT 40,
  "pmDueSoonDays" INTEGER NOT NULL DEFAULT 14,
  "staleMeterDays" INTEGER NOT NULL DEFAULT 45,
  "repeatFailureLookbackDays" INTEGER NOT NULL DEFAULT 45,
  "repeatFailureThreshold" INTEGER NOT NULL DEFAULT 3,
  "downtimeLookbackDays" INTEGER NOT NULL DEFAULT 90,
  "usageSpikePercent" REAL NOT NULL DEFAULT 40,
  "minimumDataQualityScore" REAL NOT NULL DEFAULT 40,
  "minimumConfidenceForAlert" REAL NOT NULL DEFAULT 50,
  "autoCreateRecommendations" BOOLEAN NOT NULL DEFAULT true,
  "autoCreateInternalAlerts" BOOLEAN NOT NULL DEFAULT true,
  "requireApprovalForServiceCallCreation" BOOLEAN NOT NULL DEFAULT true,
  "retentionDays" INTEGER NOT NULL DEFAULT 180,
  "scoringVersion" TEXT NOT NULL DEFAULT 'pm-pred-v1',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "predictive_maintenance_settings_organizationId_key"
  ON "predictive_maintenance_settings"("organizationId");

CREATE TABLE IF NOT EXISTS "predictive_scoring_profiles" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL DEFAULT 'org-sfx',
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "machineModel" TEXT,
  "weightsJson" TEXT NOT NULL DEFAULT '{}',
  "thresholdsJson" TEXT NOT NULL DEFAULT '{}',
  "version" TEXT NOT NULL DEFAULT '1',
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE INDEX IF NOT EXISTS "predictive_scoring_profiles_organizationId_isActive_idx"
  ON "predictive_scoring_profiles"("organizationId", "isActive");
CREATE INDEX IF NOT EXISTS "predictive_scoring_profiles_organizationId_isDefault_idx"
  ON "predictive_scoring_profiles"("organizationId", "isDefault");

CREATE TABLE IF NOT EXISTS "predictive_outcome_links" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL DEFAULT 'org-sfx',
  "healthSnapshotId" TEXT,
  "recommendationId" TEXT,
  "machineId" TEXT NOT NULL,
  "outcomeType" TEXT NOT NULL,
  "relatedEntityType" TEXT,
  "relatedEntityId" TEXT,
  "notes" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "predictive_outcome_links_organizationId_machineId_createdAt_idx"
  ON "predictive_outcome_links"("organizationId", "machineId", "createdAt");
CREATE INDEX IF NOT EXISTS "predictive_outcome_links_outcomeType_createdAt_idx"
  ON "predictive_outcome_links"("outcomeType", "createdAt");

CREATE TABLE IF NOT EXISTS "predictive_audit_events" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL DEFAULT 'org-sfx',
  "action" TEXT NOT NULL,
  "entityType" TEXT,
  "entityId" TEXT,
  "actorUserId" TEXT,
  "payloadJson" TEXT NOT NULL DEFAULT '{}',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "predictive_audit_events_organizationId_createdAt_idx"
  ON "predictive_audit_events"("organizationId", "createdAt");
CREATE INDEX IF NOT EXISTS "predictive_audit_events_action_createdAt_idx"
  ON "predictive_audit_events"("action", "createdAt");
