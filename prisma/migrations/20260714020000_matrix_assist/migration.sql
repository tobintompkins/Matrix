-- Patch 48 — Matrix Assist diagnostic sessions, messages, feedback, templates, settings

CREATE TABLE IF NOT EXISTS "MatrixAssistDiagnosticSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT,
    "serviceCallId" TEXT,
    "machineId" TEXT,
    "customerId" TEXT,
    "technicianId" TEXT,
    "technicianName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "reportedSymptom" TEXT,
    "technicianObservations" TEXT,
    "assistantSummary" TEXT,
    "suggestedCausesJson" TEXT,
    "troubleshootingStepsJson" TEXT,
    "technicianConclusion" TEXT,
    "workflowStep" INTEGER NOT NULL DEFAULT 1,
    "modelHint" TEXT,
    "errorCode" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME
);

CREATE INDEX IF NOT EXISTS "MatrixAssistDiagnosticSession_organizationId_createdAt_idx"
  ON "MatrixAssistDiagnosticSession"("organizationId", "createdAt");
CREATE INDEX IF NOT EXISTS "MatrixAssistDiagnosticSession_serviceCallId_idx"
  ON "MatrixAssistDiagnosticSession"("serviceCallId");
CREATE INDEX IF NOT EXISTS "MatrixAssistDiagnosticSession_machineId_idx"
  ON "MatrixAssistDiagnosticSession"("machineId");
CREATE INDEX IF NOT EXISTS "MatrixAssistDiagnosticSession_technicianId_status_idx"
  ON "MatrixAssistDiagnosticSession"("technicianId", "status");

CREATE TABLE IF NOT EXISTS "MatrixAssistDiagnosticStep" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "diagnosticSessionId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "instructions" TEXT,
    "result" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "technicianNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MatrixAssistDiagnosticStep_diagnosticSessionId_fkey"
      FOREIGN KEY ("diagnosticSessionId") REFERENCES "MatrixAssistDiagnosticSession" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "MatrixAssistDiagnosticStep_diagnosticSessionId_stepOrder_idx"
  ON "MatrixAssistDiagnosticStep"("diagnosticSessionId", "stepOrder");

CREATE TABLE IF NOT EXISTS "MatrixAssistMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT,
    "diagnosticSessionId" TEXT,
    "serviceCallId" TEXT,
    "machineId" TEXT,
    "userId" TEXT,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MatrixAssistMessage_diagnosticSessionId_fkey"
      FOREIGN KEY ("diagnosticSessionId") REFERENCES "MatrixAssistDiagnosticSession" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "MatrixAssistMessage_diagnosticSessionId_createdAt_idx"
  ON "MatrixAssistMessage"("diagnosticSessionId", "createdAt");
CREATE INDEX IF NOT EXISTS "MatrixAssistMessage_organizationId_createdAt_idx"
  ON "MatrixAssistMessage"("organizationId", "createdAt");

CREATE TABLE IF NOT EXISTS "MatrixAssistFeedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT,
    "diagnosticSessionId" TEXT,
    "messageId" TEXT,
    "userId" TEXT,
    "rating" TEXT NOT NULL,
    "reason" TEXT,
    "comment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MatrixAssistFeedback_diagnosticSessionId_fkey"
      FOREIGN KEY ("diagnosticSessionId") REFERENCES "MatrixAssistDiagnosticSession" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "MatrixAssistFeedback_diagnosticSessionId_idx"
  ON "MatrixAssistFeedback"("diagnosticSessionId");

CREATE TABLE IF NOT EXISTS "MatrixAssistUsageEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT,
    "userId" TEXT,
    "eventType" TEXT NOT NULL,
    "durationMs" INTEGER,
    "tokenUsage" INTEGER,
    "estimatedCostCents" INTEGER,
    "errorCode" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "MatrixAssistUsageEvent_organizationId_createdAt_idx"
  ON "MatrixAssistUsageEvent"("organizationId", "createdAt");
CREATE INDEX IF NOT EXISTS "MatrixAssistUsageEvent_eventType_createdAt_idx"
  ON "MatrixAssistUsageEvent"("eventType", "createdAt");

CREATE TABLE IF NOT EXISTS "TroubleshootingTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT,
    "printerModel" TEXT,
    "machineFamily" TEXT,
    "symptomCategory" TEXT NOT NULL,
    "errorCode" TEXT,
    "assembly" TEXT,
    "title" TEXT NOT NULL,
    "safetyNotes" TEXT,
    "stepsJson" TEXT NOT NULL,
    "relatedPartsJson" TEXT,
    "documentationRefsJson" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT 1,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "TroubleshootingTemplate_symptomCategory_printerModel_idx"
  ON "TroubleshootingTemplate"("symptomCategory", "printerModel");
CREATE INDEX IF NOT EXISTS "TroubleshootingTemplate_errorCode_idx"
  ON "TroubleshootingTemplate"("errorCode");

CREATE TABLE IF NOT EXISTS "MatrixAssistSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT 1,
    "allowHistorySummaries" BOOLEAN NOT NULL DEFAULT 1,
    "allowPartsSuggestions" BOOLEAN NOT NULL DEFAULT 1,
    "allowServiceNoteDrafts" BOOLEAN NOT NULL DEFAULT 1,
    "allowTroubleshootingTemplates" BOOLEAN NOT NULL DEFAULT 1,
    "requireFeedbackOnComplete" BOOLEAN NOT NULL DEFAULT 0,
    "maxResponseLength" INTEGER NOT NULL DEFAULT 4000,
    "conversationRetentionDays" INTEGER NOT NULL DEFAULT 90,
    "approvedModel" TEXT,
    "disclaimerOverride" TEXT,
    "updatedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "MatrixAssistSettings_organizationId_key"
  ON "MatrixAssistSettings"("organizationId");
