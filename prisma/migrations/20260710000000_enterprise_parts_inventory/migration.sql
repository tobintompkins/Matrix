-- Patch 38: Enterprise Parts & Inventory Management

-- Extend Part catalog
ALTER TABLE "Part" ADD COLUMN IF NOT EXISTS "manufacturerPartNumber" TEXT;
ALTER TABLE "Part" ADD COLUMN IF NOT EXISTS "category" TEXT;
ALTER TABLE "Part" ADD COLUMN IF NOT EXISTS "subcategory" TEXT;
ALTER TABLE "Part" ADD COLUMN IF NOT EXISTS "assembly" TEXT;
ALTER TABLE "Part" ADD COLUMN IF NOT EXISTS "diagramCalloutNumber" TEXT;
ALTER TABLE "Part" ADD COLUMN IF NOT EXISTS "unitOfMeasure" TEXT DEFAULT 'EA';
ALTER TABLE "Part" ADD COLUMN IF NOT EXISTS "preferredVendorId" TEXT;
ALTER TABLE "Part" ADD COLUMN IF NOT EXISTS "alternateVendorIds" TEXT;
ALTER TABLE "Part" ADD COLUMN IF NOT EXISTS "listPrice" DOUBLE PRECISION;
ALTER TABLE "Part" ADD COLUMN IF NOT EXISTS "weight" DOUBLE PRECISION;
ALTER TABLE "Part" ADD COLUMN IF NOT EXISTS "dimensions" TEXT;
ALTER TABLE "Part" ADD COLUMN IF NOT EXISTS "leadTimeDays" INTEGER;
ALTER TABLE "Part" ADD COLUMN IF NOT EXISTS "warranty" TEXT;
ALTER TABLE "Part" ADD COLUMN IF NOT EXISTS "photoUrl" TEXT;
ALTER TABLE "Part" ADD COLUMN IF NOT EXISTS "technicalDocuments" TEXT;
ALTER TABLE "Part" ADD COLUMN IF NOT EXISTS "safetyNotes" TEXT;
ALTER TABLE "Part" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'ACTIVE';
ALTER TABLE "Part" ADD COLUMN IF NOT EXISTS "barcode" TEXT;
ALTER TABLE "Part" ADD COLUMN IF NOT EXISTS "qrCode" TEXT;

CREATE INDEX IF NOT EXISTS "Part_barcode_idx" ON "Part"("barcode");
CREATE INDEX IF NOT EXISTS "Part_qrCode_idx" ON "Part"("qrCode");
CREATE INDEX IF NOT EXISTS "Part_category_subcategory_idx" ON "Part"("category", "subcategory");
CREATE INDEX IF NOT EXISTS "Part_status_idx" ON "Part"("status");

-- Extend WarehouseLocation
ALTER TABLE "WarehouseLocation" ADD COLUMN IF NOT EXISTS "code" TEXT;
ALTER TABLE "WarehouseLocation" ADD COLUMN IF NOT EXISTS "technician" TEXT;
ALTER TABLE "WarehouseLocation" ADD COLUMN IF NOT EXISTS "customerName" TEXT;
ALTER TABLE "WarehouseLocation" ADD COLUMN IF NOT EXISTS "region" TEXT;
ALTER TABLE "WarehouseLocation" ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS "WarehouseLocation_type_idx" ON "WarehouseLocation"("type");
CREATE INDEX IF NOT EXISTS "WarehouseLocation_code_idx" ON "WarehouseLocation"("code");

-- Extend Inventory balances
ALTER TABLE "Inventory" ADD COLUMN IF NOT EXISTS "quantityOnHand" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Inventory" ADD COLUMN IF NOT EXISTS "quantityReserved" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Inventory" ADD COLUMN IF NOT EXISTS "quantityOnOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Inventory" ADD COLUMN IF NOT EXISTS "quantityCommitted" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Inventory" ADD COLUMN IF NOT EXISTS "minimumQuantity" INTEGER;
ALTER TABLE "Inventory" ADD COLUMN IF NOT EXISTS "maximumQuantity" INTEGER;
ALTER TABLE "Inventory" ADD COLUMN IF NOT EXISTS "reorderQuantity" INTEGER;
ALTER TABLE "Inventory" ADD COLUMN IF NOT EXISTS "lastCountDate" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Inventory_warehouseLocationId_idx" ON "Inventory"("warehouseLocationId");

-- Vendor
CREATE TABLE IF NOT EXISTS "Vendor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "supportedPartNumbers" TEXT,
    "leadTimeDays" INTEGER,
    "shippingMethods" TEXT,
    "preferred" BOOLEAN NOT NULL DEFAULT false,
    "onTimeRate" DOUBLE PRECISION,
    "qualityScore" DOUBLE PRECISION,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Vendor_name_idx" ON "Vendor"("name");
CREATE INDEX IF NOT EXISTS "Vendor_preferred_idx" ON "Vendor"("preferred");

-- PurchaseRequest
CREATE TABLE IF NOT EXISTS "PurchaseRequest" (
    "id" TEXT NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "requesterId" TEXT,
    "requesterName" TEXT,
    "approverId" TEXT,
    "approverName" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "vendorId" TEXT,
    "justification" TEXT,
    "expectedDelivery" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PurchaseRequest_requestNumber_key" ON "PurchaseRequest"("requestNumber");
CREATE INDEX IF NOT EXISTS "PurchaseRequest_status_idx" ON "PurchaseRequest"("status");
CREATE INDEX IF NOT EXISTS "PurchaseRequest_requesterId_idx" ON "PurchaseRequest"("requesterId");

CREATE TABLE IF NOT EXISTS "PurchaseRequestLine" (
    "id" TEXT NOT NULL,
    "purchaseRequestId" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitCost" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseRequestLine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PurchaseRequestLine_purchaseRequestId_idx" ON "PurchaseRequestLine"("purchaseRequestId");

-- InventoryTransaction (immutable audit)
CREATE TABLE IF NOT EXISTS "InventoryTransaction" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "previousOnHand" INTEGER NOT NULL,
    "newOnHand" INTEGER NOT NULL,
    "reason" TEXT,
    "userId" TEXT,
    "userName" TEXT,
    "workOrderId" TEXT,
    "purchaseRequestId" TEXT,
    "sourceLocationId" TEXT,
    "destinationLocationId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryTransaction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "InventoryTransaction_partId_occurredAt_idx" ON "InventoryTransaction"("partId", "occurredAt");
CREATE INDEX IF NOT EXISTS "InventoryTransaction_type_occurredAt_idx" ON "InventoryTransaction"("type", "occurredAt");
CREATE INDEX IF NOT EXISTS "InventoryTransaction_workOrderId_idx" ON "InventoryTransaction"("workOrderId");
CREATE INDEX IF NOT EXISTS "InventoryTransaction_purchaseRequestId_idx" ON "InventoryTransaction"("purchaseRequestId");

-- InventoryReservation
CREATE TABLE IF NOT EXISTS "InventoryReservation" (
    "id" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "purpose" TEXT NOT NULL,
    "relatedRecordId" TEXT,
    "relatedRecordType" TEXT,
    "reservedBy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "reservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryReservation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "InventoryReservation_partId_locationId_status_idx" ON "InventoryReservation"("partId", "locationId", "status");
CREATE INDEX IF NOT EXISTS "InventoryReservation_relatedRecordId_idx" ON "InventoryReservation"("relatedRecordId");

-- Foreign keys (best-effort; ignore if already present)
DO $$ BEGIN
  ALTER TABLE "Part" ADD CONSTRAINT "Part_preferredVendorId_fkey" FOREIGN KEY ("preferredVendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "PurchaseRequestLine" ADD CONSTRAINT "PurchaseRequestLine_purchaseRequestId_fkey" FOREIGN KEY ("purchaseRequestId") REFERENCES "PurchaseRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "PurchaseRequestLine" ADD CONSTRAINT "PurchaseRequestLine_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_sourceLocationId_fkey" FOREIGN KEY ("sourceLocationId") REFERENCES "WarehouseLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_destinationLocationId_fkey" FOREIGN KEY ("destinationLocationId") REFERENCES "WarehouseLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_purchaseRequestId_fkey" FOREIGN KEY ("purchaseRequestId") REFERENCES "PurchaseRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "WarehouseLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
