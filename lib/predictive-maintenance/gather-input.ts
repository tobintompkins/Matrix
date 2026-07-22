/**
 * Patch 51A.3 — Gather machine signals from existing Matrix sources.
 */

import { prisma } from "@/lib/db/prisma";
import { listServiceCalls } from "@/lib/service-calls";
import { getDigitalTwinMachine } from "@/lib/digital-twin";
import type { MachinePredictiveInput } from "./types";

export async function gatherMachinePredictiveInput(
  machineId: string,
): Promise<MachinePredictiveInput | null> {
  const state = await prisma.machinePmState.findUnique({
    where: { machineId },
  });

  const twin = getDigitalTwinMachine(machineId);
  if (!state && !twin) return null;

  const meterRows = await prisma.machinePmMeterEntry.findMany({
    where: { machineId },
    orderBy: { recordedAt: "asc" },
    take: 50,
  });

  const calls = listServiceCalls().filter(
    (c) =>
      c.machine.machineId.toUpperCase() === machineId.toUpperCase() ||
      (state?.assetTag &&
        c.machine.assetTag.toUpperCase() === state.assetTag.toUpperCase()),
  );

  return {
    machineId,
    assetTag: state?.assetTag ?? twin?.identity.assetTag ?? null,
    nickname: state?.nickname ?? twin?.identity.nickname ?? null,
    printerModel:
      state?.printerModel ?? twin?.identity.printerModel ?? null,
    customerName:
      state?.customerName ?? twin?.location.customerName ?? null,
    siteName: state?.siteName ?? twin?.location.siteName ?? null,
    assignedTechnician:
      state?.assignedTechnician ?? twin?.assignment.assignedTechnician ?? null,
    active: state?.active ?? twin?.operational.status !== "RETIRED",
    currentMeterCount:
      state?.currentMeterCount ??
      twin?.operational.currentMeterCount ??
      null,
    lastPmCount: state?.lastPmCount ?? null,
    lastPmAt: state?.lastPmAt?.toISOString() ?? twin?.service.lastPmDate ?? null,
    pmInterval: state?.pmInterval ?? null,
    nextPmDueCount:
      state?.nextPmDueCount ?? twin?.service.nextPmMeterTarget ?? null,
    installDate: twin?.identity.installationDate ?? null,
    meterHistory: meterRows.map((r) => ({
      meterCount: r.meterCount,
      recordedAt: r.recordedAt.toISOString(),
      previousCount: r.previousCount,
    })),
    serviceCalls: calls.map((c) => ({
      id: c.id,
      status: c.status,
      priority: c.priority,
      issueTitle: c.problem.issueTitle,
      symptoms: c.problem.symptoms,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      isEmergency:
        c.priority === "EMERGENCY" || c.problem.machineCurrentlyDown,
    })),
    machineStatus: twin?.operational.status ?? null,
  };
}

export async function listPredictiveMachineIds(limit = 200): Promise<string[]> {
  const states = await prisma.machinePmState.findMany({
    where: { active: true },
    select: { machineId: true },
    take: limit,
    orderBy: { updatedAt: "desc" },
  });
  return states.map((s) => s.machineId);
}
