-- Patch 50A — Enterprise Approval Center

CREATE TABLE IF NOT EXISTS "ApprovalRequestSequence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS "ApprovalRequestSequence_organizationId_year_key"
  ON "ApprovalRequestSequence"("organizationId", "year");

CREATE TABLE IF NOT EXISTS "ApprovalRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "businessJustification" TEXT,
    "approvalType" TEXT NOT NULL,
    "sourceModule" TEXT,
    "sourceRecordId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "requesterUserId" TEXT NOT NULL,
    "requesterName" TEXT,
    "requesterDepartmentId" TEXT,
    "currentStepNumber" INTEGER NOT NULL DEFAULT 0,
    "totalSteps" INTEGER NOT NULL DEFAULT 0,
    "assignedApproverUserId" TEXT,
    "assignedApproverName" TEXT,
    "requestedAmount" REAL,
    "currency" TEXT DEFAULT 'USD',
    "dueAt" DATETIME,
    "submittedAt" DATETIME,
    "completedAt" DATETIME,
    "cancelledAt" DATETIME,
    "escalatedAt" DATETIME,
    "archivedAt" DATETIME,
    "selectedRuleId" TEXT,
    "customerId" TEXT,
    "machineId" TEXT,
    "serviceCallId" TEXT,
    "partsOrderId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "ApprovalRequest_organizationId_requestNumber_key"
  ON "ApprovalRequest"("organizationId", "requestNumber");
CREATE INDEX IF NOT EXISTS "ApprovalRequest_organizationId_status_idx"
  ON "ApprovalRequest"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "ApprovalRequest_organizationId_assignedApproverUserId_idx"
  ON "ApprovalRequest"("organizationId", "assignedApproverUserId");
CREATE INDEX IF NOT EXISTS "ApprovalRequest_organizationId_requesterUserId_idx"
  ON "ApprovalRequest"("organizationId", "requesterUserId");
CREATE INDEX IF NOT EXISTS "ApprovalRequest_organizationId_approvalType_idx"
  ON "ApprovalRequest"("organizationId", "approvalType");
CREATE INDEX IF NOT EXISTS "ApprovalRequest_organizationId_dueAt_idx"
  ON "ApprovalRequest"("organizationId", "dueAt");
CREATE INDEX IF NOT EXISTS "ApprovalRequest_organizationId_archivedAt_idx"
  ON "ApprovalRequest"("organizationId", "archivedAt");

CREATE TABLE IF NOT EXISTS "ApprovalStep" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "approvalRequestId" TEXT NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "approverType" TEXT NOT NULL DEFAULT 'PERMISSION',
    "requiredRoleId" TEXT,
    "requiredPermission" TEXT,
    "assignedUserId" TEXT,
    "assignedUserName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "minimumApprovals" INTEGER NOT NULL DEFAULT 1,
    "approvalsReceived" INTEGER NOT NULL DEFAULT 0,
    "dueAt" DATETIME,
    "completedAt" DATETIME,
    "optional" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApprovalStep_approvalRequestId_fkey"
      FOREIGN KEY ("approvalRequestId") REFERENCES "ApprovalRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ApprovalStep_approvalRequestId_stepNumber_key"
  ON "ApprovalStep"("approvalRequestId", "stepNumber");
CREATE INDEX IF NOT EXISTS "ApprovalStep_approvalRequestId_status_idx"
  ON "ApprovalStep"("approvalRequestId", "status");

CREATE TABLE IF NOT EXISTS "ApprovalDecision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "approvalRequestId" TEXT NOT NULL,
    "approvalStepId" TEXT,
    "decision" TEXT NOT NULL,
    "decidedByUserId" TEXT NOT NULL,
    "decidedByName" TEXT,
    "decidedByRoleName" TEXT,
    "comment" TEXT,
    "signatureHash" TEXT NOT NULL,
    "decidedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApprovalDecision_approvalRequestId_fkey"
      FOREIGN KEY ("approvalRequestId") REFERENCES "ApprovalRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ApprovalDecision_approvalStepId_fkey"
      FOREIGN KEY ("approvalStepId") REFERENCES "ApprovalStep"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ApprovalDecision_approvalRequestId_decidedAt_idx"
  ON "ApprovalDecision"("approvalRequestId", "decidedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "ApprovalDecision_approvalRequestId_approvalStepId_decidedByUserId_decision_key"
  ON "ApprovalDecision"("approvalRequestId", "approvalStepId", "decidedByUserId", "decision");

CREATE TABLE IF NOT EXISTS "ApprovalComment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "approvalRequestId" TEXT NOT NULL,
    "parentCommentId" TEXT,
    "authorUserId" TEXT NOT NULL,
    "authorName" TEXT,
    "authorRole" TEXT,
    "body" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    CONSTRAINT "ApprovalComment_approvalRequestId_fkey"
      FOREIGN KEY ("approvalRequestId") REFERENCES "ApprovalRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ApprovalComment_parentCommentId_fkey"
      FOREIGN KEY ("parentCommentId") REFERENCES "ApprovalComment"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ApprovalComment_approvalRequestId_createdAt_idx"
  ON "ApprovalComment"("approvalRequestId", "createdAt");

CREATE TABLE IF NOT EXISTS "ApprovalAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "approvalRequestId" TEXT NOT NULL,
    "approvalStepId" TEXT,
    "assignedToUserId" TEXT NOT NULL,
    "assignedToName" TEXT,
    "assignedByUserId" TEXT NOT NULL,
    "assignedByName" TEXT,
    "assignmentType" TEXT NOT NULL,
    "reason" TEXT,
    "startsAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApprovalAssignment_approvalRequestId_fkey"
      FOREIGN KEY ("approvalRequestId") REFERENCES "ApprovalRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ApprovalAssignment_approvalStepId_fkey"
      FOREIGN KEY ("approvalStepId") REFERENCES "ApprovalStep"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ApprovalAssignment_approvalRequestId_idx"
  ON "ApprovalAssignment"("approvalRequestId");

CREATE TABLE IF NOT EXISTS "ApprovalRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "approvalType" TEXT NOT NULL,
    "sourceModule" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "conditionsJson" TEXT NOT NULL,
    "workflowJson" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "ApprovalRule_organizationId_approvalType_isActive_idx"
  ON "ApprovalRule"("organizationId", "approvalType", "isActive");
CREATE INDEX IF NOT EXISTS "ApprovalRule_organizationId_priority_idx"
  ON "ApprovalRule"("organizationId", "priority");

CREATE TABLE IF NOT EXISTS "ApprovalAttachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "approvalRequestId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "uploadedByUserId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApprovalAttachment_approvalRequestId_fkey"
      FOREIGN KEY ("approvalRequestId") REFERENCES "ApprovalRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ApprovalAttachment_approvalRequestId_idx"
  ON "ApprovalAttachment"("approvalRequestId");
