/*
  Warnings:

  - You are about to drop the column `location` on the `Inventory` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `User` table. All the data in the column will be lost.
  - Added the required column `organizationId` to the `Customer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organizationId` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Location" ADD COLUMN "address" TEXT;
ALTER TABLE "Location" ADD COLUMN "city" TEXT;
ALTER TABLE "Location" ADD COLUMN "deletedAt" DATETIME;
ALTER TABLE "Location" ADD COLUMN "region" TEXT;
ALTER TABLE "Location" ADD COLUMN "syncedAt" DATETIME;
ALTER TABLE "Location" ADD COLUMN "timezone" TEXT;

-- AlterTable
ALTER TABLE "PMKitTemplate" ADD COLUMN "description" TEXT;

-- AlterTable
ALTER TABLE "Part" ADD COLUMN "deletedAt" DATETIME;
ALTER TABLE "Part" ADD COLUMN "description" TEXT;
ALTER TABLE "Part" ADD COLUMN "reorderLevel" INTEGER;
ALTER TABLE "Part" ADD COLUMN "syncedAt" DATETIME;
ALTER TABLE "Part" ADD COLUMN "unitCost" REAL;

-- AlterTable
ALTER TABLE "PartInstalled" ADD COLUMN "lifeUsedPct" INTEGER;
ALTER TABLE "PartInstalled" ADD COLUMN "removedAt" DATETIME;
ALTER TABLE "PartInstalled" ADD COLUMN "syncedAt" DATETIME;

-- AlterTable
ALTER TABLE "PartOrder" ADD COLUMN "neededBy" DATETIME;
ALTER TABLE "PartOrder" ADD COLUMN "requestType" TEXT;
ALTER TABLE "PartOrder" ADD COLUMN "syncedAt" DATETIME;

-- AlterTable
ALTER TABLE "Printer" ADD COLUMN "deletedAt" DATETIME;
ALTER TABLE "Printer" ADD COLUMN "firmwareVersion" TEXT;
ALTER TABLE "Printer" ADD COLUMN "installedAt" DATETIME;
ALTER TABLE "Printer" ADD COLUMN "syncedAt" DATETIME;

-- AlterTable
ALTER TABLE "PrinterModel" ADD COLUMN "capabilities" TEXT;
ALTER TABLE "PrinterModel" ADD COLUMN "deviceType" TEXT;

-- AlterTable
ALTER TABLE "ServiceTicket" ADD COLUMN "closedAt" DATETIME;
ALTER TABLE "ServiceTicket" ADD COLUMN "deletedAt" DATETIME;
ALTER TABLE "ServiceTicket" ADD COLUMN "issueSummary" TEXT;
ALTER TABLE "ServiceTicket" ADD COLUMN "jobType" TEXT;
ALTER TABLE "ServiceTicket" ADD COLUMN "openedAt" DATETIME;
ALTER TABLE "ServiceTicket" ADD COLUMN "problemDescription" TEXT;
ALTER TABLE "ServiceTicket" ADD COLUMN "syncedAt" DATETIME;

-- AlterTable
ALTER TABLE "TechnicianNote" ADD COLUMN "syncedAt" DATETIME;

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "settings" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    "syncedAt" DATETIME
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "permissions" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Role_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserRole" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WarehouseLocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WarehouseLocation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MeterHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "printerId" TEXT NOT NULL,
    "totalCount" INTEGER,
    "blackCount" INTEGER,
    "colorCount" INTEGER,
    "readAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MeterHistory_printerId_fkey" FOREIGN KEY ("printerId") REFERENCES "Printer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PrinterAlert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "printerId" TEXT NOT NULL,
    "severity" TEXT,
    "code" TEXT,
    "message" TEXT,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PrinterAlert_printerId_fkey" FOREIGN KEY ("printerId") REFERENCES "Printer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KnowledgeBaseArticle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT,
    "printerModelId" TEXT,
    "title" TEXT NOT NULL,
    "category" TEXT,
    "body" TEXT,
    "status" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "KnowledgeBaseArticle_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "KnowledgeBaseArticle_printerModelId_fkey" FOREIGN KEY ("printerModelId") REFERENCES "PrinterModel" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ServiceBulletin" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT,
    "printerModelId" TEXT,
    "bulletinNumber" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ServiceBulletin_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ServiceBulletin_printerModelId_fkey" FOREIGN KEY ("printerModelId") REFERENCES "PrinterModel" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ErrorCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT,
    "printerModelId" TEXT,
    "code" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "causes" TEXT,
    "remedies" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ErrorCode_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ErrorCode_printerModelId_fkey" FOREIGN KEY ("printerModelId") REFERENCES "PrinterModel" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Firmware" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT,
    "printerModelId" TEXT,
    "version" TEXT NOT NULL,
    "releaseNotes" TEXT,
    "releasedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Firmware_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Firmware_printerModelId_fkey" FOREIGN KEY ("printerModelId") REFERENCES "PrinterModel" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fileName" TEXT,
    "mimeType" TEXT,
    "storageKey" TEXT,
    "printerId" TEXT,
    "ticketId" TEXT,
    "uploadedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "syncedAt" DATETIME,
    CONSTRAINT "Attachment_printerId_fkey" FOREIGN KEY ("printerId") REFERENCES "Printer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Attachment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ServiceTicket" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Attachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Photo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caption" TEXT,
    "storageKey" TEXT,
    "printerId" TEXT,
    "ticketId" TEXT,
    "capturedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "syncedAt" DATETIME,
    CONSTRAINT "Photo_printerId_fkey" FOREIGN KEY ("printerId") REFERENCES "Printer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Photo_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ServiceTicket" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Photo_capturedById_fkey" FOREIGN KEY ("capturedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CustomerSignature" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "signerName" TEXT,
    "storageKey" TEXT,
    "signedAt" DATETIME,
    "printerId" TEXT,
    "ticketId" TEXT,
    "capturedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "syncedAt" DATETIME,
    CONSTRAINT "CustomerSignature_printerId_fkey" FOREIGN KEY ("printerId") REFERENCES "Printer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CustomerSignature_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ServiceTicket" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CustomerSignature_capturedById_fkey" FOREIGN KEY ("capturedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AIConversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "title" TEXT,
    "context" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AIConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AIMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AIMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AIConversation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AIRecommendation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "messageId" TEXT,
    "printerModelId" TEXT,
    "title" TEXT,
    "summary" TEXT,
    "confidence" REAL,
    "suggestedChecks" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AIRecommendation_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "AIMessage" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AIRecommendation_printerModelId_fkey" FOREIGN KEY ("printerModelId") REFERENCES "PrinterModel" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AITroubleshootingSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "printerId" TEXT,
    "ticketId" TEXT,
    "conversationId" TEXT,
    "issueCategory" TEXT,
    "status" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AITroubleshootingSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AITroubleshootingSession_printerId_fkey" FOREIGN KEY ("printerId") REFERENCES "Printer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AITroubleshootingSession_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ServiceTicket" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AITroubleshootingSession_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AIConversation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT,
    "userId" TEXT,
    "type" TEXT,
    "title" TEXT,
    "body" TEXT,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "payload" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Customer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accountNumber" TEXT,
    "status" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    "syncedAt" DATETIME,
    CONSTRAINT "Customer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Customer" ("createdAt", "id", "name", "updatedAt") SELECT "createdAt", "id", "name", "updatedAt" FROM "Customer";
DROP TABLE "Customer";
ALTER TABLE "new_Customer" RENAME TO "Customer";
CREATE INDEX "Customer_organizationId_idx" ON "Customer"("organizationId");
CREATE TABLE "new_Inventory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partId" TEXT NOT NULL,
    "warehouseLocationId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "reorderPoint" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "syncedAt" DATETIME,
    CONSTRAINT "Inventory_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Inventory_warehouseLocationId_fkey" FOREIGN KEY ("warehouseLocationId") REFERENCES "WarehouseLocation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Inventory" ("createdAt", "id", "partId", "quantity", "updatedAt") SELECT "createdAt", "id", "partId", "quantity", "updatedAt" FROM "Inventory";
DROP TABLE "Inventory";
ALTER TABLE "new_Inventory" RENAME TO "Inventory";
CREATE INDEX "Inventory_partId_idx" ON "Inventory"("partId");
CREATE UNIQUE INDEX "Inventory_partId_warehouseLocationId_key" ON "Inventory"("partId", "warehouseLocationId");
CREATE TABLE "new_PMHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "printerId" TEXT NOT NULL,
    "pmKitTemplateId" TEXT,
    "performedAt" DATETIME,
    "performedById" TEXT,
    "meterAtService" INTEGER,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "syncedAt" DATETIME,
    CONSTRAINT "PMHistory_printerId_fkey" FOREIGN KEY ("printerId") REFERENCES "Printer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PMHistory_pmKitTemplateId_fkey" FOREIGN KEY ("pmKitTemplateId") REFERENCES "PMKitTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PMHistory" ("createdAt", "id", "notes", "performedAt", "printerId", "updatedAt") SELECT "createdAt", "id", "notes", "performedAt", "printerId", "updatedAt" FROM "PMHistory";
DROP TABLE "PMHistory";
ALTER TABLE "new_PMHistory" RENAME TO "PMHistory";
CREATE INDEX "PMHistory_printerId_idx" ON "PMHistory"("printerId");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT,
    "status" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    "syncedAt" DATETIME,
    CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_User" ("createdAt", "email", "id", "name", "updatedAt") SELECT "createdAt", "email", "id", "name", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_organizationId_email_key" ON "User"("organizationId", "email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Role_organizationId_name_key" ON "Role"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_userId_roleId_key" ON "UserRole"("userId", "roleId");

-- CreateIndex
CREATE INDEX "MeterHistory_printerId_readAt_idx" ON "MeterHistory"("printerId", "readAt");

-- CreateIndex
CREATE INDEX "PrinterAlert_printerId_acknowledged_idx" ON "PrinterAlert"("printerId", "acknowledged");

-- CreateIndex
CREATE INDEX "KnowledgeBaseArticle_printerModelId_idx" ON "KnowledgeBaseArticle"("printerModelId");

-- CreateIndex
CREATE INDEX "ErrorCode_code_idx" ON "ErrorCode"("code");

-- CreateIndex
CREATE INDEX "ErrorCode_printerModelId_idx" ON "ErrorCode"("printerModelId");

-- CreateIndex
CREATE INDEX "Firmware_printerModelId_version_idx" ON "Firmware"("printerModelId", "version");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "Location_customerId_idx" ON "Location"("customerId");

-- CreateIndex
CREATE INDEX "PartInstalled_printerId_idx" ON "PartInstalled"("printerId");

-- CreateIndex
CREATE INDEX "PartOrder_status_idx" ON "PartOrder"("status");

-- CreateIndex
CREATE INDEX "Printer_locationId_idx" ON "Printer"("locationId");

-- CreateIndex
CREATE INDEX "Printer_printerModelId_idx" ON "Printer"("printerModelId");

-- CreateIndex
CREATE INDEX "Printer_serialNumber_idx" ON "Printer"("serialNumber");

-- CreateIndex
CREATE INDEX "ServiceTicket_printerId_idx" ON "ServiceTicket"("printerId");

-- CreateIndex
CREATE INDEX "ServiceTicket_assignedToId_idx" ON "ServiceTicket"("assignedToId");

-- CreateIndex
CREATE INDEX "ServiceTicket_status_idx" ON "ServiceTicket"("status");

-- CreateIndex
CREATE INDEX "TechnicianNote_printerId_idx" ON "TechnicianNote"("printerId");

-- CreateIndex
CREATE INDEX "TechnicianNote_ticketId_idx" ON "TechnicianNote"("ticketId");
