-- Controlled browser-to-server WorkOrder migration bridge.
-- Existing rows remain valid; the unique value is populated only for copied records.
ALTER TABLE "WorkOrder" ADD COLUMN "legacyWorkOrderId" TEXT;
CREATE UNIQUE INDEX "WorkOrder_legacyWorkOrderId_key" ON "WorkOrder"("legacyWorkOrderId");
