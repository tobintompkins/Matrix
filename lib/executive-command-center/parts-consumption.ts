/**
 * Patch 51C.1 — Parts consumption analytics from existing inventory transactions.
 */

import {
  listCatalog,
  listTransactions,
  usageByPart,
} from "@/lib/inventory";

export type PartsConsumptionRow = {
  partNumber: string;
  description: string;
  quantityConsumed: number;
  issueEvents: number;
  href: string;
};

export type PartsConsumptionAnalytics = {
  generatedAt: string;
  totalConsumed: number;
  distinctParts: number;
  issueEvents: number;
  topParts: PartsConsumptionRow[];
  empty: boolean;
  emptyMessage: string | null;
  href: string;
};

function inRange(iso: string, startMs: number, endMs: number): boolean {
  const t = new Date(iso).getTime();
  return t >= startMs && t < endMs;
}

export function getPartsConsumptionAnalytics(input?: {
  days?: number;
  limit?: number;
  now?: Date;
}): PartsConsumptionAnalytics {
  const days = input?.days ?? 30;
  const limit = input?.limit ?? 15;
  const now = input?.now ?? new Date();
  const endMs = now.getTime();
  const startMs = endMs - days * 86_400_000;

  const catalogPage = listCatalog("", 1, 5000);
  const descByPn = new Map(
    catalogPage.items.map((p) => [p.partNumber.toLowerCase(), p.description]),
  );

  const allTxns = listTransactions(5_000);
  const windowTxns = allTxns.filter((t) =>
    inRange(t.occurredAt, startMs, endMs),
  );
  const consumeTxns = windowTxns.filter((t) => t.type === "CONSUME");
  const usage = usageByPart(consumeTxns);

  const issueCounts = new Map<string, number>();
  for (const t of consumeTxns) {
    issueCounts.set(
      t.partNumber,
      (issueCounts.get(t.partNumber) ?? 0) + 1,
    );
  }

  const topParts: PartsConsumptionRow[] = [...usage.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([partNumber, quantityConsumed]) => ({
      partNumber,
      description:
        descByPn.get(partNumber.toLowerCase()) ?? "Catalog description unavailable",
      quantityConsumed,
      issueEvents: issueCounts.get(partNumber) ?? 0,
      href: `/inventory?q=${encodeURIComponent(partNumber)}`,
    }));

  const totalConsumed = [...usage.values()].reduce((s, n) => s + n, 0);
  const empty = topParts.length === 0;

  return {
    generatedAt: now.toISOString(),
    totalConsumed,
    distinctParts: usage.size,
    issueEvents: consumeTxns.length,
    topParts,
    empty,
    emptyMessage: empty
      ? `No CONSUME transactions in the last ${days} days.`
      : null,
    href: "/inventory",
  };
}
