-- Patch 51A.1 Part 3 — AI Assistant conversations (additive)

CREATE TABLE IF NOT EXISTS "ai_assistant_conversations" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "ownerName" TEXT,
  "title" TEXT NOT NULL DEFAULT 'New conversation',
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "contextSummary" TEXT,
  "appliedFilters" TEXT,
  "relatedEntities" TEXT,
  "messageCount" INTEGER NOT NULL DEFAULT 0,
  "providerMeta" TEXT,
  "usageMeta" TEXT,
  "lastMessageAt" DATETIME,
  "archivedAt" DATETIME,
  "deletedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE INDEX IF NOT EXISTS "ai_assistant_conversations_ownerUserId_status_updatedAt_idx"
  ON "ai_assistant_conversations"("ownerUserId", "status", "updatedAt");
CREATE INDEX IF NOT EXISTS "ai_assistant_conversations_organizationId_status_updatedAt_idx"
  ON "ai_assistant_conversations"("organizationId", "status", "updatedAt");
CREATE INDEX IF NOT EXISTS "ai_assistant_conversations_lastMessageAt_idx"
  ON "ai_assistant_conversations"("lastMessageAt");
CREATE INDEX IF NOT EXISTS "ai_assistant_conversations_createdAt_idx"
  ON "ai_assistant_conversations"("createdAt");

CREATE TABLE IF NOT EXISTS "ai_assistant_messages" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "conversationId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "requestType" TEXT,
  "queryPlan" TEXT,
  "appliedFilters" TEXT,
  "confidence" REAL,
  "retrievalSummary" TEXT,
  "limitations" TEXT,
  "dataBasis" TEXT,
  "answerFormat" TEXT,
  "followUps" TEXT,
  "errorCode" TEXT,
  "feedbackRating" TEXT,
  "feedbackComment" TEXT,
  "providerMeta" TEXT,
  "usageMeta" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_assistant_messages_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "ai_assistant_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ai_assistant_messages_conversationId_createdAt_idx"
  ON "ai_assistant_messages"("conversationId", "createdAt");

CREATE TABLE IF NOT EXISTS "ai_assistant_sources" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "messageId" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "recordId" TEXT NOT NULL,
  "displayLabel" TEXT NOT NULL,
  "href" TEXT,
  "fieldSummary" TEXT,
  "timestamp" TEXT,
  "metadata" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_assistant_sources_messageId_fkey"
    FOREIGN KEY ("messageId") REFERENCES "ai_assistant_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ai_assistant_sources_messageId_idx" ON "ai_assistant_sources"("messageId");
CREATE INDEX IF NOT EXISTS "ai_assistant_sources_sourceType_recordId_idx"
  ON "ai_assistant_sources"("sourceType", "recordId");

CREATE TABLE IF NOT EXISTS "ai_assistant_feedback" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "conversationId" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "rating" TEXT NOT NULL,
  "comment" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_assistant_feedback_messageId_fkey"
    FOREIGN KEY ("messageId") REFERENCES "ai_assistant_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ai_assistant_feedback_messageId_createdAt_idx"
  ON "ai_assistant_feedback"("messageId", "createdAt");
CREATE INDEX IF NOT EXISTS "ai_assistant_feedback_userId_createdAt_idx"
  ON "ai_assistant_feedback"("userId", "createdAt");
