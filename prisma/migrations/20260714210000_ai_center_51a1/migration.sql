-- Patch 51A.1 Part 1 — AI Operations Center foundation tables

CREATE TABLE IF NOT EXISTS "ai_sessions" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  "userId" TEXT NOT NULL,
  "sessionName" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "lastActivity" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "requestCount" INTEGER NOT NULL DEFAULT 0,
  "averageConfidence" REAL NOT NULL DEFAULT 0,
  "averageResponseTime" REAL NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS "ai_sessions_userId_lastActivity_idx" ON "ai_sessions"("userId", "lastActivity");
CREATE INDEX IF NOT EXISTS "ai_sessions_status_idx" ON "ai_sessions"("status");

CREATE TABLE IF NOT EXISTS "ai_logs" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "userId" TEXT NOT NULL,
  "sessionId" TEXT,
  "requestType" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "response" TEXT NOT NULL,
  "confidence" REAL NOT NULL,
  "executionTime" INTEGER NOT NULL,
  "success" BOOLEAN NOT NULL DEFAULT true,
  "metadata" TEXT,
  CONSTRAINT "ai_logs_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ai_sessions" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ai_logs_userId_createdAt_idx" ON "ai_logs"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "ai_logs_sessionId_createdAt_idx" ON "ai_logs"("sessionId", "createdAt");
CREATE INDEX IF NOT EXISTS "ai_logs_requestType_createdAt_idx" ON "ai_logs"("requestType", "createdAt");

CREATE TABLE IF NOT EXISTS "ai_predictions" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "predictionType" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "confidence" REAL NOT NULL,
  "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "recommendedAction" TEXT NOT NULL,
  "expiresAt" DATETIME
);

CREATE INDEX IF NOT EXISTS "ai_predictions_status_priority_idx" ON "ai_predictions"("status", "priority");
CREATE INDEX IF NOT EXISTS "ai_predictions_predictionType_createdAt_idx" ON "ai_predictions"("predictionType", "createdAt");

CREATE TABLE IF NOT EXISTS "ai_notifications" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "severity" TEXT NOT NULL DEFAULT 'INFO',
  "read" BOOLEAN NOT NULL DEFAULT false,
  "category" TEXT NOT NULL,
  "actionUrl" TEXT
);

CREATE INDEX IF NOT EXISTS "ai_notifications_read_createdAt_idx" ON "ai_notifications"("read", "createdAt");
CREATE INDEX IF NOT EXISTS "ai_notifications_category_idx" ON "ai_notifications"("category");

CREATE TABLE IF NOT EXISTS "ai_learning" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "source" TEXT NOT NULL,
  "recordsProcessed" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'COMPLETED',
  "duration" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT
);

CREATE INDEX IF NOT EXISTS "ai_learning_status_createdAt_idx" ON "ai_learning"("status", "createdAt");

CREATE TABLE IF NOT EXISTS "ai_metrics" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metricName" TEXT NOT NULL,
  "metricValue" REAL NOT NULL,
  "metricUnit" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "ai_metrics_metricName_createdAt_idx" ON "ai_metrics"("metricName", "createdAt");

CREATE TABLE IF NOT EXISTS "ai_recommendations" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
  "category" TEXT NOT NULL,
  "completed" BOOLEAN NOT NULL DEFAULT false,
  "confidence" REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS "ai_recommendations_completed_priority_idx" ON "ai_recommendations"("completed", "priority");
CREATE INDEX IF NOT EXISTS "ai_recommendations_category_createdAt_idx" ON "ai_recommendations"("category", "createdAt");
