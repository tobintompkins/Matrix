import type {
  InventoryDashboardMetrics,
  InventoryTransaction,
  PartCatalogItem,
  StockBalance,
} from "./enterprise-types";
import { quantityAvailable } from "./enterprise-types";

export function isLowStock(balance: StockBalance): boolean {
  return quantityAvailable(balance) > 0 && quantityAvailable(balance) <= balance.reorderPoint;
}

export function isOutOfStock(balance: StockBalance): boolean {
  return quantityAvailable(balance) <= 0;
}

export function isBackordered(balance: StockBalance): boolean {
  return balance.quantityOnOrder > 0 && quantityAvailable(balance) <= 0;
}

export function inventoryValue(
  catalog: PartCatalogItem[],
  balances: StockBalance[],
): number {
  const costByPart = new Map(catalog.map((p) => [p.id, p.cost]));
  return balances.reduce((sum, b) => sum + b.quantityOnHand * (costByPart.get(b.partId) ?? 0), 0);
}

export function aggregateBalancesByPart(balances: StockBalance[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const b of balances) {
    map.set(b.partId, (map.get(b.partId) ?? 0) + b.quantityOnHand);
  }
  return map;
}

export function usageByPart(transactions: InventoryTransaction[]): Map<string, number> {
  const usage = new Map<string, number>();
  for (const t of transactions) {
    if (t.type === "CONSUME") {
      usage.set(t.partNumber, (usage.get(t.partNumber) ?? 0) + t.quantity);
    }
  }
  return usage;
}

export function buildDashboardMetrics(input: {
  catalog: PartCatalogItem[];
  balances: StockBalance[];
  transactions: InventoryTransaction[];
  upcomingRequired?: Array<{ partNumber: string; reason: string }>;
  cycleCountVariancePct?: number | null;
}): InventoryDashboardMetrics {
  const { catalog, balances, transactions } = input;
  const activeParts = catalog.filter((p) => p.status === "ACTIVE");

  const lowStockParts = new Set(
    balances.filter(isLowStock).map((b) => b.partId),
  );
  const outParts = new Set(balances.filter(isOutOfStock).map((b) => b.partId));
  const backordered = new Set(balances.filter(isBackordered).map((b) => b.partId));

  const usage = usageByPart(transactions);
  const mostUsed = [...usage.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([partNumber, quantity]) => ({ partNumber, quantity }));

  const fastestMoving = mostUsed;

  const lastMoveByPart = new Map<string, string>();
  for (const t of transactions) {
    const prev = lastMoveByPart.get(t.partNumber);
    if (!prev || t.occurredAt > prev) lastMoveByPart.set(t.partNumber, t.occurredAt);
  }
  const now = Date.now();
  const slowMoving = activeParts
    .map((p) => {
      const last = lastMoveByPart.get(p.partNumber);
      const days = last
        ? Math.floor((now - new Date(last).getTime()) / 86_400_000)
        : 999;
      return { partNumber: p.partNumber, daysSinceMove: days };
    })
    .filter((x) => x.daysSinceMove >= 30)
    .sort((a, b) => b.daysSinceMove - a.daysSinceMove)
    .slice(0, 5);

  return {
    totalParts: activeParts.length,
    inventoryValue: Math.round(inventoryValue(catalog, balances) * 100) / 100,
    lowStock: lowStockParts.size,
    outOfStock: outParts.size,
    backordered: backordered.size,
    mostUsed,
    fastestMoving,
    slowMoving,
    upcomingRequired: input.upcomingRequired ?? [],
    inventoryAccuracy:
      input.cycleCountVariancePct == null
        ? null
        : Math.max(0, Math.min(100, 100 - input.cycleCountVariancePct)),
  };
}

export function searchCatalog(
  catalog: PartCatalogItem[],
  query: string,
  options?: { activeOnly?: boolean; page?: number; pageSize?: number },
): { items: PartCatalogItem[]; total: number; page: number; pageSize: number } {
  const q = query.trim().toLowerCase();
  const activeOnly = options?.activeOnly ?? true;
  let filtered = catalog.filter((p) => (activeOnly ? p.status === "ACTIVE" : true));
  if (q) {
    filtered = filtered.filter(
      (p) =>
        p.partNumber.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.manufacturerPartNumber.toLowerCase().includes(q) ||
        p.barcode.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.printerModels.some((m) => m.toLowerCase().includes(q)),
    );
  }
  const pageSize = options?.pageSize ?? 25;
  const page = Math.max(1, options?.page ?? 1);
  const start = (page - 1) * pageSize;
  return {
    items: filtered.slice(start, start + pageSize),
    total: filtered.length,
    page,
    pageSize,
  };
}

export function truckStockSummary(
  balances: StockBalance[],
  locationId: string,
  transactions: InventoryTransaction[],
): {
  current: StockBalance[];
  reserved: StockBalance[];
  lowStock: StockBalance[];
  outOfStock: StockBalance[];
  recentUsage: InventoryTransaction[];
} {
  const current = balances.filter((b) => b.locationId === locationId);
  return {
    current,
    reserved: current.filter((b) => b.quantityReserved > 0),
    lowStock: current.filter(isLowStock),
    outOfStock: current.filter(isOutOfStock),
    recentUsage: transactions
      .filter(
        (t) =>
          t.type === "CONSUME" &&
          (t.sourceLocationId === locationId || t.destinationLocationId === locationId),
      )
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
      .slice(0, 10),
  };
}
