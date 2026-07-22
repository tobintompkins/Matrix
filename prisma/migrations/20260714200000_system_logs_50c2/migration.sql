-- Patch 50C-2 — Enterprise System Logs

-- Extend existing AuditLog (do not duplicate audit store)
ALTER TABLE "AuditLog" ADD COLUMN "category" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "severity" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "outcome" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "visibility" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "environment" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "requestId" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "correlationId" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "sourceModule" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "sourceRoute" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "httpMethod" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "statusCode" INTEGER;
ALTER TABLE "AuditLog" ADD COLUMN "message" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "errorCode" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "durationMs" INTEGER;

CREATE INDEX IF NOT EXISTS "AuditLog_organizationId_category_createdAt_idx"
  ON "AuditLog"("organizationId", "category", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_organizationId_severity_createdAt_idx"
  ON "AuditLog"("organizationId", "severity", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_requestId_idx" ON "AuditLog"("requestId");
CREATE INDEX IF NOT EXISTS "AuditLog_correlationId_idx" ON "AuditLog"("correlationId");
CREATE INDEX IF NOT EXISTS "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

CREATE TABLE IF NOT EXISTS "SystemLogSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "settingsJson" TEXT NOT NULL,
    "updatedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "SystemLogSetting_organizationId_key"
  ON "SystemLogSetting"("organizationId");

CREATE TABLE IF NOT EXISTS "SystemLogRetentionPolicy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "retentionClass" TEXT NOT NULL,
    "days" INTEGER NOT NULL,
    "updatedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "SystemLogRetentionPolicy_organizationId_retentionClass_key"
  ON "SystemLogRetentionPolicy"("organizationId", "retentionClass");
CREATE INDEX IF NOT EXISTS "SystemLogRetentionPolicy_organizationId_idx"
  ON "SystemLogRetentionPolicy"("organizationId");

CREATE TABLE IF NOT EXISTS "SystemSecurityEventState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "auditLogId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "assignedUserId" TEXT,
    "assignedByUserId" TEXT,
    "acknowledgedAt" DATETIME,
    "acknowledgedByUserId" TEXT,
    "investigatingAt" DATETIME,
    "resolvedAt" DATETIME,
    "resolvedByUserId" TEXT,
    "resolutionNote" TEXT,
    "dismissedAt" DATETIME,
    "dismissedByUserId" TEXT,
    "dismissalReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "SystemSecurityEventState_auditLogId_key"
  ON "SystemSecurityEventState"("auditLogId");
CREATE INDEX IF NOT EXISTS "SystemSecurityEventState_organizationId_status_idx"
  ON "SystemSecurityEventState"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "SystemSecurityEventState_assignedUserId_status_idx"
  ON "SystemSecurityEventState"("assignedUserId", "status");

CREATE TABLE IF NOT EXISTS "SystemLogAlertRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "threshold" INTEGER NOT NULL DEFAULT 1,
    "windowMinutes" INTEGER NOT NULL DEFAULT 15,
    "severity" TEXT NOT NULL DEFAULT 'WARNING',
    "isActive" BOOLEAN NOT NULL DEFAULT 1,
    "isSystemRule" BOOLEAN NOT NULL DEFAULT 1,
    "configurationJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "SystemLogAlertRule_organizationId_code_key"
  ON "SystemLogAlertRule"("organizationId", "code");
CREATE INDEX IF NOT EXISTS "SystemLogAlertRule_organizationId_isActive_idx"
  ON "SystemLogAlertRule"("organizationId", "isActive");
