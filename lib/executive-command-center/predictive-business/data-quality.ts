/**
 * Patch 51C.2 — Data-quality panel for predictive business analytics inputs.
 */

import { listServiceCalls } from "@/lib/service-calls";
import { listTransactions, listBalances } from "@/lib/inventory";
import { listTechnicians } from "@/lib/service-dispatch";
import { prisma } from "@/lib/db/prisma";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import type { DataQualityPanel } from "./types";

export async function getPredictiveBusinessDataQuality(input?: {
  organizationId?: string;
  now?: Date;
}): Promise<DataQualityPanel> {
  const organizationId = input?.organizationId ?? DEFAULT_ORG_ID;
  const now = input?.now ?? new Date();
  const staleCutoff = now.getTime() - 30 * 86_400_000;

  const calls = listServiceCalls({ includeDeleted: false });
  const callMissing = calls.filter(
    (c) => !c.machine.machineId || !c.machine.customerName,
  ).length;
  const newestCall = calls
    .map((c) => c.createdAt)
    .sort()
    .at(-1);
  const callStale =
    !newestCall || new Date(newestCall).getTime() < staleCutoff ? 1 : 0;

  const txns = listTransactions(2_000);
  const consume = txns.filter((t) => t.type === "CONSUME");
  const balances = listBalances();

  const techs = listTechnicians();

  const pmStates = await prisma.machinePmState.findMany({
    where: { active: true },
    take: 800,
    select: {
      currentMeterCount: true,
      nextPmDueCount: true,
      updatedAt: true,
    },
  });
  const pmMissing = pmStates.filter(
    (s) => s.currentMeterCount == null || s.nextPmDueCount == null,
  ).length;

  const health = await prisma.machineHealthSnapshot.count({
    where: { organizationId },
  });

  const sources = [
    {
      source: "Service calls",
      recordCount: calls.length,
      staleOrMissing: callMissing + callStale,
      sufficient: calls.length >= 5,
      note: "Demand forecasting input",
    },
    {
      source: "Inventory CONSUME transactions",
      recordCount: consume.length,
      staleOrMissing: consume.length === 0 ? 1 : 0,
      sufficient: consume.length >= 3,
      note: "Parts demand input",
    },
    {
      source: "Inventory balances",
      recordCount: balances.length,
      staleOrMissing: 0,
      sufficient: balances.length > 0,
      note: "Stockout risk input",
    },
    {
      source: "MachinePmState",
      recordCount: pmStates.length,
      staleOrMissing: pmMissing,
      sufficient: pmStates.length >= 3,
      note: "PM workload input",
    },
    {
      source: "Technician roster",
      recordCount: techs.length,
      staleOrMissing: techs.length === 0 ? 1 : 0,
      sufficient: techs.length >= 1,
      note: "Capacity forecast input",
    },
    {
      source: "Machine health snapshots",
      recordCount: health,
      staleOrMissing: health === 0 ? 1 : 0,
      sufficient: health >= 1,
      note: "Reliability trend enrichment (existing predictive maintenance)",
    },
  ];

  const warnings = sources
    .filter((s) => !s.sufficient)
    .map((s) => `${s.source}: insufficient for high-confidence forecasts.`);

  return {
    lastRefreshAt: now.toISOString(),
    overallSufficient: sources.filter((s) => s.sufficient).length >= 3,
    sources,
    warnings,
  };
}
