-- Patch 51A.2 — AI Automation Framework (additive)

CREATE TABLE IF NOT EXISTS "ai_automation_definitions" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "category" TEXT NOT NULL DEFAULT 'GENERAL',
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "triggerType" TEXT NOT NULL,
  "eventType" TEXT,
  "scheduleExpression" TEXT,
  "timezone" TEXT DEFAULT 'America/New_York',
  "conditionMode" TEXT NOT NULL DEFAULT 'ALL',
  "conditionsJson" TEXT NOT NULL DEFAULT '{}',
  "actionsJson" TEXT NOT NULL DEFAULT '[]',
  "approvalMode" TEXT NOT NULL DEFAULT 'NONE',
  "riskLevel" TEXT NOT NULL DEFAULT 'LOW',
  "dryRunEnabled" BOOLEAN NOT NULL DEFAULT true,
  "maxRetries" INTEGER NOT NULL DEFAULT 1,
  "retryDelaySeconds" INTEGER NOT NULL DEFAULT 60,
  "timeoutSeconds" INTEGER NOT NULL DEFAULT 120,
  "failurePolicy" TEXT NOT NULL DEFAULT 'STOP',
  "lastRunAt" DATETIME,
  "nextRunAt" DATETIME,
  "lastRunStatus" TEXT,
  "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
  "createdById" TEXT,
  "updatedById" TEXT,
  "archivedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE INDEX IF NOT EXISTS "ai_automation_definitions_organizationId_status_idx"
  ON "ai_automation_definitions"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "ai_automation_definitions_triggerType_status_idx"
  ON "ai_automation_definitions"("triggerType", "status");
CREATE INDEX IF NOT EXISTS "ai_automation_definitions_eventType_status_idx"
  ON "ai_automation_definitions"("eventType", "status");
CREATE INDEX IF NOT EXISTS "ai_automation_definitions_nextRunAt_status_idx"
  ON "ai_automation_definitions"("nextRunAt", "status");

CREATE TABLE IF NOT EXISTS "ai_automation_executions" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "automationId" TEXT NOT NULL,
  "triggerSource" TEXT NOT NULL,
  "triggerReferenceId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'QUEUED',
  "startedAt" DATETIME,
  "completedAt" DATETIME,
  "inputJson" TEXT,
  "conditionResultsJson" TEXT,
  "actionResultsJson" TEXT,
  "errorJson" TEXT,
  "attemptNumber" INTEGER NOT NULL DEFAULT 1,
  "idempotencyKey" TEXT NOT NULL,
  "initiatedById" TEXT,
  "approvedById" TEXT,
  "approvedAt" DATETIME,
  "dryRun" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ai_automation_executions_automationId_fkey"
    FOREIGN KEY ("automationId") REFERENCES "ai_automation_definitions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ai_automation_executions_idempotencyKey_key"
  ON "ai_automation_executions"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "ai_automation_executions_automationId_createdAt_idx"
  ON "ai_automation_executions"("automationId", "createdAt");
CREATE INDEX IF NOT EXISTS "ai_automation_executions_organizationId_status_createdAt_idx"
  ON "ai_automation_executions"("organizationId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "ai_automation_executions_status_createdAt_idx"
  ON "ai_automation_executions"("status", "createdAt");

CREATE TABLE IF NOT EXISTS "ai_automation_approvals" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "executionId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "requestedById" TEXT,
  "assignedRole" TEXT,
  "assignedUserId" TEXT,
  "reason" TEXT NOT NULL,
  "decisionNote" TEXT,
  "decidedById" TEXT,
  "decidedAt" DATETIME,
  "expiresAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ai_automation_approvals_executionId_fkey"
    FOREIGN KEY ("executionId") REFERENCES "ai_automation_executions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ai_automation_approvals_status_createdAt_idx"
  ON "ai_automation_approvals"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "ai_automation_approvals_executionId_idx"
  ON "ai_automation_approvals"("executionId");

CREATE TABLE IF NOT EXISTS "ai_automation_templates" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "icon" TEXT NOT NULL DEFAULT 'zap',
  "definitionJson" TEXT NOT NULL,
  "isSystemTemplate" BOOLEAN NOT NULL DEFAULT true,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE INDEX IF NOT EXISTS "ai_automation_templates_category_isActive_idx"
  ON "ai_automation_templates"("category", "isActive");

CREATE TABLE IF NOT EXISTS "ai_automation_events" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL DEFAULT 'org-sfx',
  "eventType" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "payloadJson" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "availableAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" DATETIME,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "ai_automation_events_status_availableAt_idx"
  ON "ai_automation_events"("status", "availableAt");
CREATE INDEX IF NOT EXISTS "ai_automation_events_eventType_createdAt_idx"
  ON "ai_automation_events"("eventType", "createdAt");
CREATE INDEX IF NOT EXISTS "ai_automation_events_entityType_entityId_idx"
  ON "ai_automation_events"("entityType", "entityId");

CREATE TABLE IF NOT EXISTS "ai_automation_settings" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "automationEnabled" BOOLEAN NOT NULL DEFAULT true,
  "allowAiConditions" BOOLEAN NOT NULL DEFAULT true,
  "defaultApprovalMode" TEXT NOT NULL DEFAULT 'BEFORE_HIGH_IMPACT_ACTION',
  "defaultMaxRetries" INTEGER NOT NULL DEFAULT 1,
  "defaultTimeoutSeconds" INTEGER NOT NULL DEFAULT 120,
  "executionRetentionDays" INTEGER NOT NULL DEFAULT 90,
  "maxConcurrentRuns" INTEGER NOT NULL DEFAULT 5,
  "highImpactActionsRequireApproval" BOOLEAN NOT NULL DEFAULT true,
  "autoPauseFailureThreshold" INTEGER NOT NULL DEFAULT 5,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "ai_automation_settings_organizationId_key"
  ON "ai_automation_settings"("organizationId");
