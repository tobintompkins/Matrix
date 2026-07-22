-- Patch 51B — Enterprise Customer Portal expansions

CREATE TABLE IF NOT EXISTS "PortalConfiguration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "settingsJson" TEXT NOT NULL,
    "updatedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "PortalConfiguration_organizationId_key"
  ON "PortalConfiguration"("organizationId");

CREATE TABLE IF NOT EXISTS "PortalOnboardingState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "membershipId" TEXT NOT NULL,
    "completedAt" DATETIME,
    "stepsJson" TEXT,
    "termsAcceptedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "PortalOnboardingState_membershipId_key"
  ON "PortalOnboardingState"("membershipId");
CREATE INDEX IF NOT EXISTS "PortalOnboardingState_membershipId_idx"
  ON "PortalOnboardingState"("membershipId");

CREATE TABLE IF NOT EXISTS "CustomerChangeRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT,
    "customerId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "requestType" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewNote" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CustomerChangeRequest_customerId_status_idx"
  ON "CustomerChangeRequest"("customerId", "status");
CREATE INDEX IF NOT EXISTS "CustomerChangeRequest_membershipId_idx"
  ON "CustomerChangeRequest"("membershipId");

CREATE TABLE IF NOT EXISTS "AnnouncementAcknowledgment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "announcementId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "acknowledgedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "AnnouncementAcknowledgment_announcementId_membershipId_key"
  ON "AnnouncementAcknowledgment"("announcementId", "membershipId");
CREATE INDEX IF NOT EXISTS "AnnouncementAcknowledgment_membershipId_idx"
  ON "AnnouncementAcknowledgment"("membershipId");

CREATE TABLE IF NOT EXISTS "PortalPartsRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "machineId" TEXT,
    "locationId" TEXT,
    "requestType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "businessReason" TEXT,
    "urgency" TEXT NOT NULL DEFAULT 'NORMAL',
    "serviceRequestId" TEXT,
    "shippingContact" TEXT,
    "shippingAddress" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "purchaseRequestId" TEXT,
    "approvalRequestId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME
);
CREATE UNIQUE INDEX IF NOT EXISTS "PortalPartsRequest_customerId_requestNumber_key"
  ON "PortalPartsRequest"("customerId", "requestNumber");
CREATE INDEX IF NOT EXISTS "PortalPartsRequest_customerId_status_idx"
  ON "PortalPartsRequest"("customerId", "status");
CREATE INDEX IF NOT EXISTS "PortalPartsRequest_membershipId_idx"
  ON "PortalPartsRequest"("membershipId");

CREATE TABLE IF NOT EXISTS "PortalNotificationPreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "membershipId" TEXT NOT NULL,
    "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT false,
    "smsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "serviceUpdates" BOOLEAN NOT NULL DEFAULT true,
    "pmReminders" BOOLEAN NOT NULL DEFAULT true,
    "meterReminders" BOOLEAN NOT NULL DEFAULT true,
    "partsUpdates" BOOLEAN NOT NULL DEFAULT true,
    "announcements" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "PortalNotificationPreference_membershipId_key"
  ON "PortalNotificationPreference"("membershipId");
