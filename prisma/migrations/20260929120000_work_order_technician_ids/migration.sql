-- Patch 51B.2 — durable Field technician assignment IDs (nullable; names preserved).
ALTER TABLE "WorkOrder" ADD COLUMN "assignedTechnicianId" TEXT;
ALTER TABLE "WorkOrder" ADD COLUMN "secondaryTechnicianId" TEXT;

CREATE INDEX "WorkOrder_assignedTechnicianId_idx" ON "WorkOrder"("assignedTechnicianId");
CREATE INDEX "WorkOrder_secondaryTechnicianId_idx" ON "WorkOrder"("secondaryTechnicianId");
