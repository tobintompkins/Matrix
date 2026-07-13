import type { RepeatFailureFlag } from "./types";

export type TicketLite = {
  id: string;
  printerId: string;
  serialNumber: string;
  category: string;
  createdAt: string;
  status: string;
  partsReplaced: string[];
  downtimeMinutes: number;
  reopened: boolean;
};

const DAY_MS = 86_400_000;

export function detectRepeatFailures(
  tickets: TicketLite[],
  options?: {
    threshold7d?: number;
    sameIssue30d?: number;
    downtimeMinutes?: number;
    from?: Date;
  },
): RepeatFailureFlag[] {
  const from = options?.from ?? new Date();
  const threshold7d = options?.threshold7d ?? 2;
  const sameIssue30d = options?.sameIssue30d ?? 2;
  const downtimeLimit = options?.downtimeMinutes ?? 480;

  const byPrinter = new Map<string, TicketLite[]>();
  for (const t of tickets) {
    const list = byPrinter.get(t.printerId) ?? [];
    list.push(t);
    byPrinter.set(t.printerId, list);
  }

  const flags: RepeatFailureFlag[] = [];

  for (const [printerId, list] of byPrinter) {
    const recent7 = list.filter(
      (t) => from.getTime() - new Date(t.createdAt).getTime() <= 7 * DAY_MS,
    );
    const recent30 = list.filter(
      (t) => from.getTime() - new Date(t.createdAt).getTime() <= 30 * DAY_MS,
    );

    const categoryCounts = new Map<string, number>();
    for (const t of recent30) {
      categoryCounts.set(t.category, (categoryCounts.get(t.category) ?? 0) + 1);
    }
    let commonCategory = "";
    let commonCount = 0;
    for (const [cat, count] of categoryCounts) {
      if (count > commonCount) {
        commonCategory = cat;
        commonCount = count;
      }
    }

    const partCounts = new Map<string, number>();
    for (const t of recent30) {
      for (const p of t.partsReplaced) {
        partCounts.set(p, (partCounts.get(p) ?? 0) + 1);
      }
    }
    const repeatedPart = [...partCounts.entries()].some(([, n]) => n >= 2);
    const downtime = recent30.reduce((s, t) => s + t.downtimeMinutes, 0);
    const reopened = list.some((t) => t.reopened);

    const badge =
      recent7.length >= threshold7d ||
      commonCount >= sameIssue30d ||
      repeatedPart ||
      downtime >= downtimeLimit ||
      reopened;

    if (!badge) continue;

    const reasons: string[] = [];
    if (recent7.length >= threshold7d) reasons.push(`${recent7.length} tickets in 7 days`);
    if (commonCount >= sameIssue30d) reasons.push(`Same issue (${commonCategory}) ×${commonCount} in 30 days`);
    if (repeatedPart) reasons.push("Same part replaced repeatedly");
    if (downtime >= downtimeLimit) reasons.push("Excessive downtime");
    if (reopened) reasons.push("Recently resolved ticket reopened");

    flags.push({
      printerId,
      serialNumber: list[0]?.serialNumber ?? "",
      ticketCount7d: recent7.length,
      sameIssue30d: commonCount,
      badge: true,
      relatedTicketIds: recent30.map((t) => t.id),
      commonCategory,
      recommendation: `Technical review recommended — ${reasons.join("; ")}`,
    });
  }

  return flags;
}
