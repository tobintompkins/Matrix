-- Patch 39: Mobile Field Offline / Sync foundation

CREATE TABLE IF NOT EXISTS "DeviceRegistration" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "deviceLabel" TEXT,
    "userAgent" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DeviceRegistration_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "DeviceRegistration_userId_idx" ON "DeviceRegistration"("userId");

CREATE TABLE IF NOT EXISTS "WorkSession" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT,
    "technicianId" TEXT,
    "technicianName" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "travelStartedAt" TIMESTAMP(3),
    "arrivedAt" TIMESTAMP(3),
    "workStartedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "totalTravelMs" INTEGER NOT NULL DEFAULT 0,
    "totalLaborMs" INTEGER NOT NULL DEFAULT 0,
    "totalPausedMs" INTEGER NOT NULL DEFAULT 0,
    "eventsJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkSession_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "WorkSession_workOrderId_idx" ON "WorkSession"("workOrderId");
CREATE INDEX IF NOT EXISTS "WorkSession_technicianId_active_idx" ON "WorkSession"("technicianId", "active");

CREATE TABLE IF NOT EXISTS "OfflineOperation" (
    "id" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "userId" TEXT,
    "technicianName" TEXT,
    "workOrderId" TEXT,
    "printerId" TEXT,
    "payload" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "conflictStatus" TEXT,
    "dependsOnJson" TEXT,
    "synchronizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OfflineOperation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "OfflineOperation_operationId_key" ON "OfflineOperation"("operationId");
CREATE INDEX IF NOT EXISTS "OfflineOperation_status_createdAt_idx" ON "OfflineOperation"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "OfflineOperation_userId_status_idx" ON "OfflineOperation"("userId", "status");
CREATE INDEX IF NOT EXISTS "OfflineOperation_workOrderId_idx" ON "OfflineOperation"("workOrderId");

CREATE TABLE IF NOT EXISTS "SyncAttempt" (
    "id" TEXT NOT NULL,
    "offlineOperationId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "processed" INTEGER NOT NULL DEFAULT 0,
    "succeeded" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "conflicts" INTEGER NOT NULL DEFAULT 0,
    "errorsJson" TEXT,
    CONSTRAINT "SyncAttempt_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SyncAttempt_startedAt_idx" ON "SyncAttempt"("startedAt");

CREATE TABLE IF NOT EXISTS "SyncConflict" (
    "id" TEXT NOT NULL,
    "offlineOperationId" TEXT,
    "operationId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "offlineValue" TEXT,
    "serverValue" TEXT,
    "offlineChangedAt" TIMESTAMP(3),
    "serverChangedAt" TIMESTAMP(3),
    "serverChangedBy" TEXT,
    "recommended" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SyncConflict_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SyncConflict_status_idx" ON "SyncConflict"("status");
CREATE INDEX IF NOT EXISTS "SyncConflict_operationId_idx" ON "SyncConflict"("operationId");

CREATE TABLE IF NOT EXISTS "OfflinePackageMetadata" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "workOrderNumber" TEXT,
    "technicianId" TEXT NOT NULL,
    "downloadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "sizeBytes" INTEGER,
    "readiness" TEXT NOT NULL DEFAULT 'READY',
    "serverRevision" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OfflinePackageMetadata_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "OfflinePackageMetadata_technicianId_workOrderId_idx" ON "OfflinePackageMetadata"("technicianId", "workOrderId");

CREATE TABLE IF NOT EXISTS "AttachmentUpload" (
    "id" TEXT NOT NULL,
    "operationId" TEXT,
    "workOrderId" TEXT,
    "category" TEXT,
    "fileName" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "storageRef" TEXT,
    "uploaded" BOOLEAN NOT NULL DEFAULT false,
    "uploadedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AttachmentUpload_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AttachmentUpload_workOrderId_idx" ON "AttachmentUpload"("workOrderId");
CREATE INDEX IF NOT EXISTS "AttachmentUpload_operationId_idx" ON "AttachmentUpload"("operationId");
