-- Patch 42: Secure Customer Portal

CREATE TABLE IF NOT EXISTS "CustomerMembership" (
    "id" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "email" TEXT,
    "displayName" TEXT,
    "customerId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "invitedBy" TEXT,
    "invitedAt" DATETIME,
    "acceptedAt" DATETIME,
    "disabledAt" DATETIME,
    "lastPortalLogin" DATETIME,
    "canApproveService" BOOLEAN NOT NULL DEFAULT false,
    "canViewMeters" BOOLEAN NOT NULL DEFAULT false,
    "canViewPm" BOOLEAN NOT NULL DEFAULT true,
    "canDownloadReports" BOOLEAN NOT NULL DEFAULT true,
    "canManageUsers" BOOLEAN NOT NULL DEFAULT false,
    "jobTitle" TEXT,
    "phone" TEXT,
    "preferredContactMethod" TEXT,
    "timeZone" TEXT,
    "defaultLocationId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CustomerMembership_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CustomerMembership_clerkUserId_status_idx" ON "CustomerMembership"("clerkUserId", "status");
CREATE INDEX IF NOT EXISTS "CustomerMembership_customerId_status_idx" ON "CustomerMembership"("customerId", "status");
CREATE INDEX IF NOT EXISTS "CustomerMembership_email_idx" ON "CustomerMembership"("email");

CREATE TABLE IF NOT EXISTS "CustomerLocationAccess" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "accessLevel" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CustomerLocationAccess_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CustomerLocationAccess_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "CustomerMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerLocationAccess_membershipId_locationId_key" ON "CustomerLocationAccess"("membershipId", "locationId");
CREATE INDEX IF NOT EXISTS "CustomerLocationAccess_locationId_idx" ON "CustomerLocationAccess"("locationId");

CREATE TABLE IF NOT EXISTS "CustomerPrinterAccess" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "printerId" TEXT NOT NULL,
    "accessLevel" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CustomerPrinterAccess_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CustomerPrinterAccess_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "CustomerMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerPrinterAccess_membershipId_printerId_key" ON "CustomerPrinterAccess"("membershipId", "printerId");
CREATE INDEX IF NOT EXISTS "CustomerPrinterAccess_printerId_idx" ON "CustomerPrinterAccess"("printerId");

CREATE TABLE IF NOT EXISTS "PortalInvitation" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "customerId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "invitedBy" TEXT,
    "invitedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "acceptedAt" DATETIME,
    "cancelledAt" DATETIME,
    "locationIdsJson" TEXT,
    "printerIdsJson" TEXT,
    "canApproveService" BOOLEAN NOT NULL DEFAULT false,
    "canViewMeters" BOOLEAN NOT NULL DEFAULT false,
    "canViewPm" BOOLEAN NOT NULL DEFAULT true,
    "canDownloadReports" BOOLEAN NOT NULL DEFAULT true,
    "canManageUsers" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PortalInvitation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PortalInvitation_email_status_idx" ON "PortalInvitation"("email", "status");
CREATE INDEX IF NOT EXISTS "PortalInvitation_customerId_status_idx" ON "PortalInvitation"("customerId", "status");

CREATE TABLE IF NOT EXISTS "PortalAnnouncement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "locationId" TEXT,
    "priority" TEXT,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "createdBy" TEXT,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "acknowledgmentRequired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PortalAnnouncement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PortalAnnouncement_customerId_visible_idx" ON "PortalAnnouncement"("customerId", "visible");
CREATE INDEX IF NOT EXISTS "PortalAnnouncement_locationId_idx" ON "PortalAnnouncement"("locationId");

CREATE TABLE IF NOT EXISTS "PortalDocument" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "fileUrl" TEXT,
    "customerId" TEXT NOT NULL,
    "locationId" TEXT,
    "printerId" TEXT,
    "visibleToCustomer" BOOLEAN NOT NULL DEFAULT true,
    "uploadedBy" TEXT,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expirationDate" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PortalDocument_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PortalDocument_customerId_visibleToCustomer_active_idx" ON "PortalDocument"("customerId", "visibleToCustomer", "active");
CREATE INDEX IF NOT EXISTS "PortalDocument_locationId_idx" ON "PortalDocument"("locationId");
CREATE INDEX IF NOT EXISTS "PortalDocument_printerId_idx" ON "PortalDocument"("printerId");

CREATE TABLE IF NOT EXISTS "PortalFeedback" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "resolutionSatisfaction" INTEGER,
    "technicianProfessionalism" INTEGER,
    "communicationQuality" INTEGER,
    "responseTimeSatisfaction" INTEGER,
    "comment" TEXT,
    "followUpRequested" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PortalFeedback_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PortalFeedback_ticketId_membershipId_key" ON "PortalFeedback"("ticketId", "membershipId");
CREATE INDEX IF NOT EXISTS "PortalFeedback_ticketId_idx" ON "PortalFeedback"("ticketId");

CREATE TABLE IF NOT EXISTS "PortalAuditEntry" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor" TEXT,
    "membershipId" TEXT,
    "customerId" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "previousValue" TEXT,
    "newValue" TEXT,
    "sessionInfo" TEXT,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PortalAuditEntry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PortalAuditEntry_customerId_occurredAt_idx" ON "PortalAuditEntry"("customerId", "occurredAt");
CREATE INDEX IF NOT EXISTS "PortalAuditEntry_membershipId_idx" ON "PortalAuditEntry"("membershipId");
CREATE INDEX IF NOT EXISTS "PortalAuditEntry_action_idx" ON "PortalAuditEntry"("action");
