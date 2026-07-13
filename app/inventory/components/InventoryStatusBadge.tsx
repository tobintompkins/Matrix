"use client";

import { MatrixStatusBadge, inventoryStatusToVariant } from "../../components/ui";
import type { BinStockStatus } from "@/lib/warehouse";

const STATUS_MAP: Record<BinStockStatus, string> = {
  Healthy: "In Stock",
  Low: "Low Stock",
  Critical: "Critical",
  "Out of Stock": "Out of Stock",
  "Back Ordered": "Backordered",
  Discontinued: "Inactive",
};

export default function InventoryStatusBadge({
  status,
}: {
  status: BinStockStatus;
}) {
  const mapped = STATUS_MAP[status] ?? status;
  return (
    <MatrixStatusBadge
      variant={inventoryStatusToVariant(mapped)}
      label={status}
    />
  );
}
