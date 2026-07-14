-- Patch 49A — Enterprise Administration Center foundation

CREATE TABLE IF NOT EXISTS "AdminDirectoryUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "clerkUserId" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "matrixRole" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "isActive" BOOLEAN NOT NULL DEFAULT 1,
    "primaryRegionId" TEXT,
    "managerId" TEXT,
    "accessScope" TEXT NOT NULL DEFAULT 'ORGANIZATION',
    "lastActiveAt" DATETIME,
    "deactivatedAt" DATETIME,
    "deactivatedByUserId" TEXT,
    "deactivationReason" TEXT,
    "updatedAtVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "AdminDirectoryUser_organizationId_email_key"
  ON "AdminDirectoryUser"("organizationId", "email");
CREATE INDEX IF NOT EXISTS "AdminDirectoryUser_organizationId_status_idx"
  ON "AdminDirectoryUser"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "AdminDirectoryUser_organizationId_matrixRole_idx"
  ON "AdminDirectoryUser"("organizationId", "matrixRole");
CREATE INDEX IF NOT EXISTS "AdminDirectoryUser_primaryRegionId_idx"
  ON "AdminDirectoryUser"("primaryRegionId");
CREATE INDEX IF NOT EXISTS "AdminDirectoryUser_managerId_idx"
  ON "AdminDirectoryUser"("managerId");

CREATE TABLE IF NOT EXISTS "AdminRegion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT 1,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "AdminRegion_organizationId_key_key"
  ON "AdminRegion"("organizationId", "key");
CREATE INDEX IF NOT EXISTS "AdminRegion_organizationId_active_idx"
  ON "AdminRegion"("organizationId", "active");

CREATE TABLE IF NOT EXISTS "AdminFeatureControl" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "featureKey" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT 1,
    "description" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "AdminFeatureControl_organizationId_featureKey_key"
  ON "AdminFeatureControl"("organizationId", "featureKey");
CREATE INDEX IF NOT EXISTS "AdminFeatureControl_organizationId_idx"
  ON "AdminFeatureControl"("organizationId");

CREATE TABLE IF NOT EXISTS "AdminConfigurationEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "configurationType" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT 1,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "protected" BOOLEAN NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "AdminConfigurationEntry_organizationId_configurationType_key_key"
  ON "AdminConfigurationEntry"("organizationId", "configurationType", "key");
CREATE INDEX IF NOT EXISTS "AdminConfigurationEntry_organizationId_configurationType_active_idx"
  ON "AdminConfigurationEntry"("organizationId", "configurationType", "active");

CREATE TABLE IF NOT EXISTS "AdminOrganizationProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "legalName" TEXT,
    "displayName" TEXT,
    "supportEmail" TEXT,
    "supportPhone" TEXT,
    "website" TEXT,
    "address" TEXT,
    "defaultTimeZone" TEXT DEFAULT 'America/New_York',
    "dateFormat" TEXT DEFAULT 'MM/dd/yyyy',
    "timeFormat" TEXT DEFAULT '12h',
    "defaultRegionId" TEXT,
    "defaultWarehouseId" TEXT,
    "businessHours" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "AdminOrganizationProfile_organizationId_key"
  ON "AdminOrganizationProfile"("organizationId");
