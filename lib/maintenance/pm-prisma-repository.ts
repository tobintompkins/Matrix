/**
 * Patch 45 — Prisma-backed PM / cleaning count repository.
 *
 * SERVER-ONLY: import from API routes / Server Components / server actions only.
 * Do not import from client components (pulls Prisma + SQLite adapter).
 * (Uses a comment instead of `import "server-only"` so the maintenance barrel
 * can re-export types/helpers without breaking client `/maintenance` UI.)
 *
 * Dual-writes PM completions to the sessionStorage maintenance repo when possible
 * so existing /maintenance UI stays in sync.
 */

import { digitalTwinFleet } from "@/lib/digital-twin/data";
import { prisma } from "@/lib/db/prisma";
import { sampleMaintenanceProfiles } from "./data";
import { getDefaultIntervalForModel } from "./intervals";
import {
  calculateNextPmDueCount,
  calculatePmCleaningStatus,
  type PmCleaningStatus,
  type PmCleaningStatusResult,
} from "./pm-status";
import { completeMaintenance } from "./repository";
import { validateWholeNonNegativeCount } from "./calculations";
import {
  DEFAULT_PM_CHECKLIST_DEFS,
  DEPRECATED_PM_CHECKLIST_KEYS,
  buildChecklistFromDefs,
  calculateLaborMinutes,
  checklistCompletionPercent,
  validateChecklistForCompletion,
  validatePmTimeRange,
  type PmPartUsed,
  type PmWorkflowChecklistItem,
} from "./pm-checklist";
import {
  calculatePmQualityScore,
  PM_QUALITY_SCORE_FORMULA,
} from "./pm-quality";
import { findPartByNumber } from "@/lib/inventory";

export type PmDashboardFilters = {
  status?: PmCleaningStatus | PmCleaningStatus[];
  customerName?: string;
  siteName?: string;
  printerModel?: string;
  assignedTechnician?: string;
  search?: string;
  activeOnly?: boolean;
};

export type PmDashboardRow = {
  machineId: string;
  assetTag: string | null;
  nickname: string | null;
  printerModel: string | null;
  customerName: string | null;
  siteName: string | null;
  assignedTechnician: string | null;
  currentMeterCount: number | null;
  lastPmCount: number | null;
  lastPmAt: string | null;
  lastPmTechnician: string | null;
  lastLaborMinutes: number | null;
  pmInterval: number | null;
  dueSoonThreshold: number | null;
  nextPmDueCount: number | null;
  modelDefaultInterval: number | null;
  active: boolean;
  status: PmCleaningStatus;
  displayLabel: string;
  countsRemaining: number | null;
  countsOverdue: number | null;
};

export type PmDashboardSummary = {
  total: number;
  notConfigured: number;
  good: number;
  dueSoon: number;
  due: number;
  overdue: number;
  active: number;
};

export type RecordPmMeterReadingInput = {
  machineId: string;
  meterCount: number;
  enteredBy: string;
  notes?: string;
  lowerCountReason?: string;
  recordedAt?: string | Date;
  idempotencyKey?: string;
};

export type CompletePmInput = {
  machineId: string;
  countAtCompletion: number;
  technician: string;
  recordedBy?: string;
  notes?: string;
  completedAt?: string | Date;
  idempotencyKey: string;
  /** When set, overrides state.pmInterval for this completion. */
  pmInterval?: number;
  /** Patch 46 */
  timeStarted?: string | Date;
  timeFinished?: string | Date;
  checklist?: PmWorkflowChecklistItem[];
  partsUsed?: PmPartUsed[];
  workPerformed?: string;
  customerSignaturePlaceholder?: string;
};

export type SetMachinePmIntervalInput = {
  machineId: string;
  interval: number | null;
  actor: string;
  dueSoonThreshold?: number | null;
};

export type ListPmHistoryFilters = {
  machineId?: string;
  technician?: string;
  from?: string | Date;
  to?: string | Date;
  search?: string;
  statusAtCompletion?: string;
  limit?: number;
  page?: number;
  pageSize?: number;
};

function normalizeMachineId(machineId: string): string {
  return machineId.trim().toUpperCase();
}

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  return value.toISOString();
}

function statusForState(row: {
  currentMeterCount: number | null;
  lastPmCount: number | null;
  pmInterval: number | null;
  dueSoonThreshold: number | null;
}): PmCleaningStatusResult {
  return calculatePmCleaningStatus({
    currentCount: row.currentMeterCount,
    lastPmCount: row.lastPmCount,
    pmInterval: row.pmInterval,
    dueSoonThreshold: row.dueSoonThreshold,
  });
}

function toDashboardRow(
  row: Awaited<ReturnType<typeof prisma.machinePmState.findMany>>[number],
): PmDashboardRow {
  const calc = statusForState(row);
  return {
    machineId: row.machineId,
    assetTag: row.assetTag,
    nickname: row.nickname,
    printerModel: row.printerModel,
    customerName: row.customerName,
    siteName: row.siteName,
    assignedTechnician: row.assignedTechnician,
    currentMeterCount: row.currentMeterCount,
    lastPmCount: row.lastPmCount,
    lastPmAt: toIso(row.lastPmAt),
    lastPmTechnician: row.lastPmTechnician,
    lastLaborMinutes: row.lastLaborMinutes ?? null,
    pmInterval: row.pmInterval,
    dueSoonThreshold: row.dueSoonThreshold,
    nextPmDueCount: calc.nextPmDueCount ?? row.nextPmDueCount,
    modelDefaultInterval: row.modelDefaultInterval,
    active: row.active,
    status: calc.status,
    displayLabel: calc.displayLabel,
    countsRemaining: calc.countsRemaining,
    countsOverdue: calc.countsOverdue,
  };
}

async function writePmAudit(
  // Prisma transaction client or root client
  tx: {
    machinePmAuditLog: {
      create: (args: {
        data: {
          machineId: string | null;
          user: string | null;
          action: string;
          previousValue: string | null;
          newValue: string | null;
          details: string | null;
        };
      }) => Promise<unknown>;
    };
  },
  input: {
    machineId?: string | null;
    user?: string | null;
    action: string;
    previousValue?: string | null;
    newValue?: string | null;
    details?: string | null;
  },
) {
  await tx.machinePmAuditLog.create({
    data: {
      machineId: input.machineId ?? null,
      user: input.user ?? null,
      action: input.action,
      previousValue: input.previousValue ?? null,
      newValue: input.newValue ?? null,
      details: input.details ?? null,
    },
  });
}

const CHECKLIST_MODELS = [
  "GD9630",
  "GL9730",
  "Valezus",
  "T2200",
  "T2100",
];

export async function ensurePmChecklistTemplatesSeeded(): Promise<number> {
  let created = 0;

  // Deactivate legacy addendum-superseded keys (preserve rows; never delete).
  for (const model of CHECKLIST_MODELS) {
    for (const oldKey of DEPRECATED_PM_CHECKLIST_KEYS) {
      const legacy = await prisma.machinePmChecklistTemplate.findUnique({
        where: {
          printerModel_itemKey: {
            printerModel: model,
            itemKey: oldKey,
          },
        },
      });
      if (legacy?.active) {
        await prisma.machinePmChecklistTemplate.update({
          where: { id: legacy.id },
          data: { active: false, updatedAt: new Date() },
        });
        await writePmAudit(prisma, {
          action: "PM_CHECKLIST_TEMPLATE_CHANGED",
          user: "system",
          previousValue: JSON.stringify({
            printerModel: model,
            itemKey: oldKey,
            active: true,
          }),
          newValue: JSON.stringify({
            printerModel: model,
            itemKey: oldKey,
            active: false,
          }),
          details: "Deprecated by Patch 46 addendum alignment",
        });
      }
    }
  }

  for (const model of CHECKLIST_MODELS) {
    for (const def of DEFAULT_PM_CHECKLIST_DEFS) {
      const existing = await prisma.machinePmChecklistTemplate.findUnique({
        where: {
          printerModel_itemKey: {
            printerModel: model,
            itemKey: def.itemKey,
          },
        },
      });
      if (existing) {
        const needsUpdate =
          existing.taskName !== def.taskName ||
          existing.description !== def.description ||
          existing.sortOrder !== def.sortOrder ||
          existing.required !== def.required ||
          !existing.active;
        if (needsUpdate) {
          await prisma.machinePmChecklistTemplate.update({
            where: { id: existing.id },
            data: {
              taskName: def.taskName,
              description: def.description,
              sortOrder: def.sortOrder,
              required: def.required,
              active: true,
              updatedAt: new Date(),
            },
          });
          await writePmAudit(prisma, {
            action: "PM_CHECKLIST_TEMPLATE_CHANGED",
            user: "system",
            previousValue: JSON.stringify({
              taskName: existing.taskName,
              active: existing.active,
            }),
            newValue: JSON.stringify({
              taskName: def.taskName,
              active: true,
            }),
            details: `${model}/${def.itemKey}`,
          });
        }
        continue;
      }
      await prisma.machinePmChecklistTemplate.create({
        data: {
          printerModel: model,
          itemKey: def.itemKey,
          taskName: def.taskName,
          description: def.description,
          sortOrder: def.sortOrder,
          required: def.required,
          active: true,
        },
      });
      await writePmAudit(prisma, {
        action: "PM_CHECKLIST_TEMPLATE_CREATED",
        user: "system",
        newValue: JSON.stringify({
          printerModel: model,
          itemKey: def.itemKey,
          taskName: def.taskName,
        }),
      });
      created += 1;
    }
  }
  return created;
}

export async function getChecklistForModel(
  printerModel: string | null | undefined,
): Promise<PmWorkflowChecklistItem[]> {
  await ensurePmChecklistTemplatesSeeded();
  const modelKey =
    printerModel?.trim() ||
    "GD9630";
  const templates = await prisma.machinePmChecklistTemplate.findMany({
    where: { printerModel: modelKey, active: true },
    orderBy: { sortOrder: "asc" },
  });
  if (templates.length === 0) {
    return buildChecklistFromDefs(DEFAULT_PM_CHECKLIST_DEFS);
  }
  return templates.map((t) => ({
    id: t.itemKey,
    itemKey: t.itemKey,
    taskName: t.taskName,
    description: t.description ?? "",
    required: t.required,
    sortOrder: t.sortOrder,
    status: "PENDING" as const,
    notes: "",
    skipReason: "",
  }));
}

/**
 * Upsert MachinePmState from digitalTwinFleet + sampleMaintenanceProfiles.
 * pmInterval is set from model default ONLY when the seed profile has lastPMCopyCount
 * (configured). Machines without a PM baseline stay pmInterval null (Not Configured).
 */
export async function ensurePmFleetSeeded(): Promise<{ upserted: number }> {
  const profileById = new Map(
    sampleMaintenanceProfiles.map((p) => [normalizeMachineId(p.printerId), p]),
  );

  let upserted = 0;
  for (const machine of digitalTwinFleet) {
    const machineId = normalizeMachineId(machine.identity.machineId);
    const profile = profileById.get(machineId);
    const modelDefault = getDefaultIntervalForModel(
      machine.identity.printerModel,
    ).pmInterval;

    const lastPmCount =
      profile?.lastPMCopyCount !== null &&
      profile?.lastPMCopyCount !== undefined
        ? profile.lastPMCopyCount
        : null;

    // Configured only when seed has a last PM count baseline.
    const pmInterval = lastPmCount !== null ? modelDefault : null;
    const meter = profile?.currentCopyCount ?? machine.operational.currentMeterCount;
    const currentMeterCount = Number.isFinite(meter) ? meter : null;
    const nextPmDueCount = calculateNextPmDueCount(lastPmCount, pmInterval);

    const lastPmAt =
      profile?.lastPMDate != null
        ? new Date(`${profile.lastPMDate}T12:00:00.000Z`)
        : /^\d{4}-\d{2}-\d{2}$/.test(machine.service.lastPmDate)
          ? new Date(`${machine.service.lastPmDate}T12:00:00.000Z`)
          : null;

    const existing = await prisma.machinePmState.findUnique({
      where: { machineId },
    });

    if (!existing) {
      await prisma.machinePmState.create({
        data: {
          machineId,
          assetTag: machine.identity.assetTag,
          nickname: machine.identity.nickname,
          printerModel: machine.identity.printerModel,
          customerName: machine.location.customerName,
          siteName: machine.location.siteName,
          assignedTechnician: machine.assignment.assignedTechnician,
          currentMeterCount,
          lastPmCount,
          lastPmAt,
          lastPmTechnician: null,
          pmInterval,
          dueSoonThreshold: null,
          nextPmDueCount,
          modelDefaultInterval: modelDefault,
          active: true,
          printerId: null,
        },
      });
    } else {
      // Refresh denormalized fleet labels; only fill blank PM fields (safe re-seed).
      const mergedLastPm = existing.lastPmCount ?? lastPmCount;
      const mergedInterval = existing.pmInterval ?? pmInterval;
      await prisma.machinePmState.update({
        where: { machineId },
        data: {
          assetTag: machine.identity.assetTag,
          nickname: machine.identity.nickname,
          printerModel: machine.identity.printerModel,
          customerName: machine.location.customerName,
          siteName: machine.location.siteName,
          assignedTechnician: machine.assignment.assignedTechnician,
          modelDefaultInterval: modelDefault,
          currentMeterCount: existing.currentMeterCount ?? currentMeterCount,
          lastPmCount: mergedLastPm,
          lastPmAt: existing.lastPmAt ?? lastPmAt,
          pmInterval: mergedInterval,
          nextPmDueCount:
            existing.nextPmDueCount ??
            calculateNextPmDueCount(mergedLastPm, mergedInterval),
        },
      });
    }
    upserted += 1;
  }

  return { upserted };
}

export async function listPmDashboardRows(
  filters: PmDashboardFilters = {},
): Promise<PmDashboardRow[]> {
  await ensurePmFleetSeeded();

  const rows = await prisma.machinePmState.findMany({
    where: {
      active: filters.activeOnly === false ? undefined : true,
      customerName: filters.customerName
        ? { contains: filters.customerName }
        : undefined,
      siteName: filters.siteName ? { contains: filters.siteName } : undefined,
      printerModel: filters.printerModel
        ? { contains: filters.printerModel }
        : undefined,
      assignedTechnician: filters.assignedTechnician
        ? { contains: filters.assignedTechnician }
        : undefined,
      OR: filters.search
        ? [
            { machineId: { contains: filters.search } },
            { assetTag: { contains: filters.search } },
            { nickname: { contains: filters.search } },
            { customerName: { contains: filters.search } },
            { siteName: { contains: filters.search } },
          ]
        : undefined,
    },
    orderBy: [{ customerName: "asc" }, { machineId: "asc" }],
  });

  let mapped = rows.map(toDashboardRow);

  if (filters.status) {
    const wanted = Array.isArray(filters.status)
      ? new Set(filters.status)
      : new Set([filters.status]);
    mapped = mapped.filter((r) => wanted.has(r.status));
  }

  return mapped;
}

export async function getPmDashboardSummary(): Promise<PmDashboardSummary> {
  const rows = await listPmDashboardRows({ activeOnly: true });
  const summary: PmDashboardSummary = {
    total: rows.length,
    notConfigured: 0,
    good: 0,
    dueSoon: 0,
    due: 0,
    overdue: 0,
    active: rows.filter((r) => r.active).length,
  };
  for (const row of rows) {
    switch (row.status) {
      case "NOT_CONFIGURED":
        summary.notConfigured += 1;
        break;
      case "GOOD":
        summary.good += 1;
        break;
      case "DUE_SOON":
        summary.dueSoon += 1;
        break;
      case "DUE":
        summary.due += 1;
        break;
      case "OVERDUE":
        summary.overdue += 1;
        break;
    }
  }
  return summary;
}

export async function getMachinePmDetail(machineId: string) {
  await ensurePmFleetSeeded();
  const id = normalizeMachineId(machineId);
  const state = await prisma.machinePmState.findUnique({
    where: { machineId: id },
    include: {
      history: {
        orderBy: { completedAt: "desc" },
        take: 25,
      },
    },
  });
  if (!state) return null;

  const recentMeters = await prisma.machinePmMeterEntry.findMany({
    where: { machineId: id },
    orderBy: { recordedAt: "desc" },
    take: 25,
  });

  const row = toDashboardRow(state);
  return {
    ...row,
    history: state.history.map((h) => ({
      id: h.id,
      machineId: h.machineId,
      completedAt: h.completedAt.toISOString(),
      countAtCompletion: h.countAtCompletion,
      previousPmCount: h.previousPmCount,
      pmIntervalAtCompletion: h.pmIntervalAtCompletion,
      technician: h.technician,
      recordedBy: h.recordedBy,
      notes: h.notes,
      idempotencyKey: h.idempotencyKey,
      laborMinutes: h.laborMinutes ?? null,
      qualityScore: h.qualityScore ?? null,
      checklistCompletionPct: h.checklistCompletionPct ?? null,
      statusAtCompletion: h.statusAtCompletion ?? null,
      partsUsedJson: h.partsUsedJson ?? null,
      checklistJson: h.checklistJson ?? null,
      timeStarted: h.timeStarted?.toISOString() ?? null,
      timeFinished: h.timeFinished?.toISOString() ?? null,
    })),
    recentMeters: recentMeters.map((m) => ({
      id: m.id,
      machineId: m.machineId,
      meterCount: m.meterCount,
      previousCount: m.previousCount,
      enteredBy: m.enteredBy,
      notes: m.notes,
      lowerCountReason: m.lowerCountReason,
      recordedAt: m.recordedAt.toISOString(),
      idempotencyKey: m.idempotencyKey,
    })),
  };
}

export async function setMachinePmInterval(
  machineId: string,
  interval: number | null,
  actor: string,
  dueSoonThreshold?: number | null,
): Promise<
  | { ok: true; row: PmDashboardRow }
  | { ok: false; error: string }
> {
  await ensurePmFleetSeeded();
  const id = normalizeMachineId(machineId);

  if (interval !== null) {
    const validated = validateWholeNonNegativeCount(interval);
    if (!validated.ok) return validated;
    if (validated.value <= 0) {
      return { ok: false, error: "PM interval must be greater than zero." };
    }
  }

  const existing = await prisma.machinePmState.findUnique({
    where: { machineId: id },
  });
  if (!existing) {
    return { ok: false, error: `Machine not found: ${id}` };
  }

  const nextPmDueCount = calculateNextPmDueCount(
    existing.lastPmCount,
    interval,
  );

  const updated = await prisma.machinePmState.update({
    where: { machineId: id },
    data: {
      pmInterval: interval,
      dueSoonThreshold:
        dueSoonThreshold === undefined
          ? existing.dueSoonThreshold
          : dueSoonThreshold,
      nextPmDueCount,
      updatedAt: new Date(),
    },
  });

  await writePmAudit(prisma, {
    machineId: id,
    user: actor,
    action: "PM_INTERVAL_UPDATED",
    previousValue: String(existing.pmInterval ?? ""),
    newValue: String(interval ?? ""),
  });

  return { ok: true, row: toDashboardRow(updated) };
}

export async function recordPmMeterReading(
  input: RecordPmMeterReadingInput,
): Promise<
  | { ok: true; row: PmDashboardRow; entryId: string; idempotent?: boolean }
  | { ok: false; error: string }
> {
  await ensurePmFleetSeeded();
  const machineId = normalizeMachineId(input.machineId);
  const validated = validateWholeNonNegativeCount(input.meterCount);
  if (!validated.ok) return validated;
  if (!input.enteredBy.trim()) {
    return { ok: false, error: "enteredBy is required." };
  }

  if (input.idempotencyKey) {
    const prior = await prisma.machinePmMeterEntry.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (prior) {
      const state = await prisma.machinePmState.findUnique({
        where: { machineId },
      });
      if (!state) return { ok: false, error: `Machine not found: ${machineId}` };
      return {
        ok: true,
        row: toDashboardRow(state),
        entryId: prior.id,
        idempotent: true,
      };
    }
  }

  const existing = await prisma.machinePmState.findUnique({
    where: { machineId },
  });
  if (!existing) {
    return { ok: false, error: `Machine not found: ${machineId}` };
  }

  if (
    existing.currentMeterCount !== null &&
    validated.value < existing.currentMeterCount &&
    !input.lowerCountReason?.trim()
  ) {
    return {
      ok: false,
      error: "lowerCountReason is required when meter count decreases.",
    };
  }

  const nextPmDueCount = calculateNextPmDueCount(
    existing.lastPmCount,
    existing.pmInterval,
  );
  const recordedAt = input.recordedAt
    ? new Date(input.recordedAt)
    : new Date();

  const result = await prisma.$transaction(async (tx) => {
    const entry = await tx.machinePmMeterEntry.create({
      data: {
        machineId,
        meterCount: validated.value,
        previousCount: existing.currentMeterCount,
        enteredBy: input.enteredBy.trim(),
        notes: input.notes?.trim() || null,
        lowerCountReason: input.lowerCountReason?.trim() || null,
        recordedAt,
        idempotencyKey: input.idempotencyKey ?? null,
      },
    });

    const state = await tx.machinePmState.update({
      where: { machineId },
      data: {
        currentMeterCount: validated.value,
        nextPmDueCount,
        updatedAt: new Date(),
      },
    });

    await writePmAudit(tx, {
      machineId,
      user: input.enteredBy.trim(),
      action: "PM_METER_RECORDED",
      previousValue: String(existing.currentMeterCount ?? ""),
      newValue: String(validated.value),
      details: `entryId=${entry.id}`,
    });

    return { entry, state };
  });

  return {
    ok: true,
    row: toDashboardRow(result.state),
    entryId: result.entry.id,
  };
}

export async function completePm(
  input: CompletePmInput,
): Promise<
  | {
      ok: true;
      row: PmDashboardRow;
      historyId: string;
      qualityScore?: number;
      idempotent?: boolean;
    }
  | { ok: false; error: string }
> {
  await ensurePmFleetSeeded();
  await ensurePmChecklistTemplatesSeeded();
  const machineId = normalizeMachineId(input.machineId);
  const validated = validateWholeNonNegativeCount(input.countAtCompletion);
  if (!validated.ok) return validated;
  if (!input.technician.trim()) {
    return { ok: false, error: "Technician is required." };
  }
  if (!input.idempotencyKey?.trim()) {
    return { ok: false, error: "idempotencyKey is required." };
  }

  // Patch 45 compatibility: when checklist omitted, auto-mark template items DONE.
  // Patch 46 workflow always sends an explicit checklist from the completion form.
  let checklist: PmWorkflowChecklistItem[];
  if (input.checklist && input.checklist.length > 0) {
    const checklistCheck = validateChecklistForCompletion(input.checklist);
    if (!checklistCheck.ok) return checklistCheck;
    checklist = input.checklist;
  } else {
    const template = await getChecklistForModel(
      (
        await prisma.machinePmState.findUnique({ where: { machineId } })
      )?.printerModel,
    );
    checklist = template.map((item) => ({
      ...item,
      status: "DONE" as const,
      notes: item.notes || "Auto-completed (quick complete)",
    }));
  }

  const timeFinished = input.timeFinished
    ? new Date(input.timeFinished)
    : input.completedAt
      ? new Date(input.completedAt)
      : new Date();
  const timeStarted = input.timeStarted
    ? new Date(input.timeStarted)
    : new Date(timeFinished.getTime() - 60 * 60 * 1000);
  const timeCheck = validatePmTimeRange(timeStarted, timeFinished);
  if (!timeCheck.ok) return timeCheck;

  const prior = await prisma.machinePmHistory.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });
  if (prior) {
    const state = await prisma.machinePmState.findUnique({
      where: { machineId },
    });
    if (!state) return { ok: false, error: `Machine not found: ${machineId}` };
    return {
      ok: true,
      row: toDashboardRow(state),
      historyId: prior.id,
      qualityScore: prior.qualityScore ?? undefined,
      idempotent: true,
    };
  }

  const existing = await prisma.machinePmState.findUnique({
    where: { machineId },
  });
  if (!existing) {
    return { ok: false, error: `Machine not found: ${machineId}` };
  }

  const interval =
    input.pmInterval ??
    existing.pmInterval ??
    existing.modelDefaultInterval ??
    getDefaultIntervalForModel(existing.printerModel ?? "GD9630").pmInterval;

  if (!interval || interval <= 0) {
    return {
      ok: false,
      error: "PM interval is not configured for this machine.",
    };
  }

  const laborMinutes = calculateLaborMinutes(timeStarted, timeFinished);
  const completedAt = timeFinished;
  const statusAtCompletion = calculatePmCleaningStatus({
    currentCount: validated.value,
    lastPmCount: existing.lastPmCount,
    pmInterval: interval,
    dueSoonThreshold: existing.dueSoonThreshold,
  }).status;
  const checklistPct = checklistCompletionPercent(checklist);
  const qualityScore = calculatePmQualityScore({
    checklist,
    notes: input.notes,
    partsUsed: input.partsUsed,
    meterRecorded: true,
    laborMinutes,
  });
  const nextPmDueCount = calculateNextPmDueCount(validated.value, interval);
  const partsUsed = normalizePartsUsed(input.partsUsed ?? []);

  const txResult = await prisma.$transaction(async (tx) => {
    const history = await tx.machinePmHistory.create({
      data: {
        machinePmStateId: existing.id,
        machineId,
        completedAt,
        countAtCompletion: validated.value,
        previousPmCount: existing.lastPmCount,
        pmIntervalAtCompletion: interval,
        technician: input.technician.trim(),
        recordedBy: input.recordedBy?.trim() || null,
        notes: input.notes?.trim() || null,
        idempotencyKey: input.idempotencyKey,
        timeStarted,
        timeFinished,
        laborMinutes,
        qualityScore,
        checklistJson: JSON.stringify(checklist),
        checklistCompletionPct: checklistPct,
        partsUsedJson: JSON.stringify(partsUsed),
        statusAtCompletion,
        workPerformed: input.workPerformed?.trim() || null,
        customerSignaturePlaceholder:
          input.customerSignaturePlaceholder?.trim() || null,
      },
    });

    const state = await tx.machinePmState.update({
      where: { machineId },
      data: {
        lastPmCount: validated.value,
        lastPmAt: completedAt,
        lastPmTechnician: input.technician.trim(),
        lastLaborMinutes: laborMinutes,
        pmInterval: existing.pmInterval ?? interval,
        currentMeterCount: Math.max(
          existing.currentMeterCount ?? 0,
          validated.value,
        ),
        nextPmDueCount,
        updatedAt: new Date(),
      },
    });

    await tx.machinePmDraft.deleteMany({
      where: {
        machineId,
        technician: input.technician.trim(),
      },
    });

    await writePmAudit(tx, {
      machineId,
      user: input.recordedBy ?? input.technician,
      action: "PM_COMPLETED",
      previousValue: JSON.stringify({
        lastPmCount: existing.lastPmCount,
        lastPmAt: existing.lastPmAt,
      }),
      newValue: JSON.stringify({
        lastPmCount: validated.value,
        qualityScore,
        laborMinutes,
      }),
      details: `historyId=${history.id}`,
    });

    return { history, state };
  });

  try {
    completeMaintenance({
      printerId: machineId,
      kind: "PM",
      completedAt: completedAt.toISOString(),
      copyCountAtCompletion: validated.value,
      technician: input.technician.trim(),
      notes: input.notes?.trim() ?? "",
      workPerformed: input.workPerformed?.trim() || "PM completed (Patch 46)",
    });
  } catch {
    // Prisma is source of truth
  }

  return {
    ok: true,
    row: toDashboardRow(txResult.state),
    historyId: txResult.history.id,
    qualityScore,
  };
}

function normalizePartsUsed(parts: PmPartUsed[]): PmPartUsed[] {
  return parts.map((p) => {
    const partNumber = p.partNumber.trim();
    const catalog = partNumber ? findPartByNumber(partNumber) : null;
    return {
      partId: p.partId ?? catalog?.id ?? null,
      partNumber,
      description: (p.description || catalog?.description || "").trim(),
      quantity: Number(p.quantity),
    };
  });
}

function mapHistoryRow(
  h: Awaited<ReturnType<typeof prisma.machinePmHistory.findMany>>[number],
  state?: {
    customerName: string | null;
    nickname: string | null;
    assetTag: string | null;
    printerModel: string | null;
  } | null,
) {
  return {
    id: h.id,
    machineId: h.machineId,
    completedAt: h.completedAt.toISOString(),
    countAtCompletion: h.countAtCompletion,
    previousPmCount: h.previousPmCount,
    pmIntervalAtCompletion: h.pmIntervalAtCompletion,
    technician: h.technician,
    recordedBy: h.recordedBy,
    notes: h.notes,
    idempotencyKey: h.idempotencyKey,
    customerName: state?.customerName ?? null,
    nickname: state?.nickname ?? null,
    serialOrAsset: state?.assetTag ?? h.machineId,
    printerModel: state?.printerModel ?? null,
    laborMinutes: h.laborMinutes ?? null,
    qualityScore: h.qualityScore ?? null,
    checklistCompletionPct: h.checklistCompletionPct ?? null,
    statusAtCompletion: h.statusAtCompletion ?? null,
    partsUsedJson: h.partsUsedJson ?? null,
    timeStarted: h.timeStarted?.toISOString() ?? null,
    timeFinished: h.timeFinished?.toISOString() ?? null,
    workPerformed: h.workPerformed ?? null,
    customerSignaturePlaceholder: h.customerSignaturePlaceholder ?? null,
    checklistJson: h.checklistJson ?? null,
  };
}

export async function listPmHistory(filters: ListPmHistoryFilters = {}) {
  await ensurePmFleetSeeded();
  const pageSize = Math.min(
    Math.max(filters.pageSize ?? filters.limit ?? 25, 1),
    filters.pageSize && filters.pageSize > 100 ? 5000 : 100,
  );
  const page = Math.max(filters.page ?? 1, 1);
  const skip = (page - 1) * pageSize;

  const where: {
    machineId?: string;
    technician?: { contains: string };
    statusAtCompletion?: string;
    completedAt?: { gte?: Date; lte?: Date };
    OR?: Array<Record<string, unknown>>;
  } = {
    machineId: filters.machineId
      ? normalizeMachineId(filters.machineId)
      : undefined,
    technician: filters.technician
      ? { contains: filters.technician }
      : undefined,
    statusAtCompletion: filters.statusAtCompletion || undefined,
    completedAt: {
      gte: filters.from ? new Date(filters.from) : undefined,
      lte: filters.to ? new Date(filters.to) : undefined,
    },
  };

  const search = filters.search?.trim();
  if (search) {
    where.OR = [
      { machineId: { contains: search } },
      { technician: { contains: search } },
      { notes: { contains: search } },
      { recordedBy: { contains: search } },
      { partsUsedJson: { contains: search } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.machinePmHistory.count({ where }),
    prisma.machinePmHistory.findMany({
      where,
      orderBy: { completedAt: "desc" },
      skip,
      take: pageSize,
    }),
  ]);

  const machineIds = [...new Set(rows.map((r) => r.machineId))];
  const states =
    machineIds.length > 0
      ? await prisma.machinePmState.findMany({
          where: { machineId: { in: machineIds } },
        })
      : [];
  const stateById = new Map(states.map((s) => [s.machineId, s]));

  return {
    rows: rows.map((h) => mapHistoryRow(h, stateById.get(h.machineId))),
    total,
    page,
    pageSize,
  };
}

export async function getPmHistoryById(historyId: string) {
  const h = await prisma.machinePmHistory.findUnique({
    where: { id: historyId },
  });
  if (!h) return null;
  const state = await prisma.machinePmState.findUnique({
    where: { machineId: h.machineId },
  });
  const mapped = mapHistoryRow(h, state);
  return {
    ...mapped,
    checklist: h.checklistJson
      ? (JSON.parse(h.checklistJson) as PmWorkflowChecklistItem[])
      : [],
    partsUsed: h.partsUsedJson
      ? (JSON.parse(h.partsUsedJson) as PmPartUsed[])
      : [],
  };
}

export async function exportPmHistoryCsv(
  filters: ListPmHistoryFilters = {},
): Promise<string> {
  const { rows } = await listPmHistory({
    ...filters,
    page: 1,
    pageSize: Math.min(filters.limit ?? 5000, 5000),
  });
  const header = [
    "id",
    "machineId",
    "completedAt",
    "countAtCompletion",
    "previousPmCount",
    "pmIntervalAtCompletion",
    "technician",
    "recordedBy",
    "notes",
    "laborMinutes",
    "qualityScore",
    "checklistCompletionPct",
    "statusAtCompletion",
    "partsUsedJson",
    "idempotencyKey",
  ];

  const escape = (value: unknown): string => {
    if (value === null || value === undefined) return "";
    const s = String(value);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.id,
        row.machineId,
        row.completedAt,
        row.countAtCompletion,
        row.previousPmCount,
        row.pmIntervalAtCompletion,
        row.technician,
        row.recordedBy,
        row.notes,
        row.laborMinutes,
        row.qualityScore,
        row.checklistCompletionPct,
        row.statusAtCompletion,
        row.partsUsedJson,
        row.idempotencyKey,
      ]
        .map(escape)
        .join(","),
    );
  }
  return lines.join("\n");
}

export async function exportTechnicianPmCsv(): Promise<string> {
  const reports = await getPmReports();
  const header = ["technician", "completions", "averageLaborMinutes"];
  const escape = (value: unknown): string => {
    if (value === null || value === undefined) return "";
    const s = String(value);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [header.join(",")];
  for (const row of reports.technicianActivity) {
    lines.push(
      [row.technician, row.completions, row.averageLaborMinutes]
        .map(escape)
        .join(","),
    );
  }
  return lines.join("\n");
}

export async function exportCustomerPmCsv(): Promise<string> {
  const rows = await listPmDashboardRows({ activeOnly: true });
  const map = new Map<
    string,
    { total: number; due: number; overdue: number; good: number }
  >();
  for (const r of rows) {
    const name = r.customerName ?? "Unknown";
    const cur = map.get(name) ?? { total: 0, due: 0, overdue: 0, good: 0 };
    cur.total += 1;
    if (r.status === "DUE") cur.due += 1;
    if (r.status === "OVERDUE") cur.overdue += 1;
    if (r.status === "GOOD") cur.good += 1;
    map.set(name, cur);
  }
  const header = [
    "customerName",
    "totalMachines",
    "pmDue",
    "pmOverdue",
    "pmGood",
  ];
  const lines = [header.join(",")];
  for (const [customerName, v] of [...map.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    lines.push(
      [customerName, v.total, v.due, v.overdue, v.good].join(","),
    );
  }
  return lines.join("\n");
}

export async function savePmDraft(input: {
  machineId: string;
  technician: string;
  checklist: PmWorkflowChecklistItem[];
  partsUsed?: PmPartUsed[];
  notes?: string;
  timeStarted?: string | Date;
  meterReading?: number | null;
}): Promise<{ ok: true; draftId: string } | { ok: false; error: string }> {
  await ensurePmFleetSeeded();
  const machineId = normalizeMachineId(input.machineId);
  const tech = input.technician.trim();
  if (!tech) return { ok: false, error: "Technician is required." };
  const state = await prisma.machinePmState.findUnique({ where: { machineId } });
  if (!state) return { ok: false, error: `Machine not found: ${machineId}` };

  const prior = await prisma.machinePmDraft.findUnique({
    where: { machineId_technician: { machineId, technician: tech } },
  });
  const priorChecklist = prior
    ? (JSON.parse(prior.checklistJson) as PmWorkflowChecklistItem[])
    : [];
  const priorParts = prior?.partsUsedJson
    ? (JSON.parse(prior.partsUsedJson) as PmPartUsed[])
    : [];
  const partsUsed = normalizePartsUsed(input.partsUsed ?? []);
  const isNewDraft = !prior;
  const startedNow =
    Boolean(input.timeStarted) &&
    (!prior?.timeStarted ||
      new Date(prior.timeStarted).getTime() !==
        new Date(input.timeStarted!).getTime());

  const draft = await prisma.machinePmDraft.upsert({
    where: {
      machineId_technician: { machineId, technician: tech },
    },
    create: {
      machinePmStateId: state.id,
      machineId,
      technician: tech,
      checklistJson: JSON.stringify(input.checklist),
      partsUsedJson: JSON.stringify(partsUsed),
      notes: input.notes ?? null,
      timeStarted: input.timeStarted ? new Date(input.timeStarted) : null,
      meterReading: input.meterReading ?? null,
    },
    update: {
      checklistJson: JSON.stringify(input.checklist),
      partsUsedJson: JSON.stringify(partsUsed),
      notes: input.notes ?? null,
      timeStarted: input.timeStarted ? new Date(input.timeStarted) : null,
      meterReading: input.meterReading ?? null,
      updatedAt: new Date(),
    },
  });

  if (isNewDraft || startedNow) {
    await writePmAudit(prisma, {
      machineId,
      user: tech,
      action: "PM_STARTED",
      newValue: draft.id,
      details: input.timeStarted
        ? `timeStarted=${new Date(input.timeStarted).toISOString()}`
        : undefined,
    });
  }

  for (const item of input.checklist) {
    if (item.status !== "SKIPPED") continue;
    const prev = priorChecklist.find((p) => p.itemKey === item.itemKey);
    if (prev?.status === "SKIPPED" && prev.skipReason === item.skipReason) {
      continue;
    }
    await writePmAudit(prisma, {
      machineId,
      user: tech,
      action: "PM_CHECKLIST_ITEM_SKIPPED",
      previousValue: prev ? JSON.stringify(prev) : null,
      newValue: JSON.stringify({
        itemKey: item.itemKey,
        skipReason: item.skipReason,
      }),
    });
  }

  if (JSON.stringify(priorParts) !== JSON.stringify(partsUsed)) {
    await writePmAudit(prisma, {
      machineId,
      user: tech,
      action: "PM_PARTS_USAGE_CHANGED",
      previousValue: JSON.stringify(priorParts),
      newValue: JSON.stringify(partsUsed),
    });
  }

  await writePmAudit(prisma, {
    machineId,
    user: tech,
    action: "PM_DRAFT_SAVED",
    newValue: draft.id,
    details: "Incomplete checklist progress preserved in database",
  });

  return { ok: true, draftId: draft.id };
}

export async function getPmDraft(machineId: string, technician: string) {
  await ensurePmFleetSeeded();
  const id = normalizeMachineId(machineId);
  const draft = await prisma.machinePmDraft.findUnique({
    where: {
      machineId_technician: {
        machineId: id,
        technician: technician.trim(),
      },
    },
  });
  if (!draft) return null;
  return {
    id: draft.id,
    machineId: draft.machineId,
    technician: draft.technician,
    checklist: JSON.parse(draft.checklistJson) as PmWorkflowChecklistItem[],
    partsUsed: draft.partsUsedJson
      ? (JSON.parse(draft.partsUsedJson) as PmPartUsed[])
      : [],
    notes: draft.notes,
    timeStarted: draft.timeStarted?.toISOString() ?? null,
    meterReading: draft.meterReading,
    updatedAt: draft.updatedAt.toISOString(),
  };
}

export async function getTechnicianPmDashboard(technician: string) {
  await ensurePmFleetSeeded();
  const tech = technician.trim();
  const rows = await listPmDashboardRows({ activeOnly: true });
  const assigned = rows.filter(
    (r) =>
      (r.assignedTechnician ?? "").toLowerCase() === tech.toLowerCase() ||
      tech === "",
  );
  const scope = tech ? assigned : rows;

  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(startOfDay);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

  const history = await prisma.machinePmHistory.findMany({
    where: tech
      ? { technician: { contains: tech } }
      : undefined,
    orderBy: { completedAt: "desc" },
    take: 500,
  });

  const completedToday = history.filter(
    (h) => h.completedAt >= startOfDay,
  ).length;
  const completedThisWeek = history.filter(
    (h) => h.completedAt >= startOfWeek,
  ).length;
  const laborValues = history
    .map((h) => h.laborMinutes)
    .filter((v): v is number => v != null && v >= 0);
  const averagePmTime =
    laborValues.length === 0
      ? null
      : Math.round(
          laborValues.reduce((a, b) => a + b, 0) / laborValues.length,
        );

  return {
    technician: tech || "All technicians",
    todaysPms: scope.filter((r) =>
      ["DUE", "DUE_SOON", "OVERDUE"].includes(r.status),
    ).length,
    overduePms: scope.filter((r) => r.status === "OVERDUE").length,
    duePms: scope.filter((r) => r.status === "DUE").length,
    dueSoonPms: scope.filter((r) => r.status === "DUE_SOON").length,
    completedToday,
    completedThisWeek,
    averagePmTimeMinutes: averagePmTime,
    assignedMachines: scope,
  };
}

export async function getCustomerPmSummary(customerName: string) {
  await ensurePmFleetSeeded();
  const rows = await listPmDashboardRows({
    customerName,
    activeOnly: true,
  });
  const history = await listPmHistory({ page: 1, pageSize: 200 });
  const customerHistory = history.rows.filter(
    (h) =>
      (h.customerName ?? "").toLowerCase() === customerName.toLowerCase(),
  );
  const lastPm = customerHistory[0] ?? null;
  const nextDue = [...rows]
    .filter((r) => r.nextPmDueCount != null)
    .sort(
      (a, b) => (a.countsRemaining ?? 999999) - (b.countsRemaining ?? 999999),
    )[0];

  return {
    customerName,
    totalMachines: rows.length,
    pmDue: rows.filter((r) => r.status === "DUE").length,
    pmOverdue: rows.filter((r) => r.status === "OVERDUE").length,
    pmDueSoon: rows.filter((r) => r.status === "DUE_SOON").length,
    good: rows.filter((r) => r.status === "GOOD").length,
    notConfigured: rows.filter((r) => r.status === "NOT_CONFIGURED").length,
    lastPmCompleted: lastPm?.completedAt ?? null,
    lastPmTechnician: lastPm?.technician ?? null,
    nextScheduledHint: nextDue
      ? {
          machineId: nextDue.machineId,
          nickname: nextDue.nickname,
          nextPmDueCount: nextDue.nextPmDueCount,
          countsRemaining: nextDue.countsRemaining,
          status: nextDue.status,
        }
      : null,
    fleetHealth:
      rows.length === 0
        ? "No machines"
        : rows.every((r) => r.status === "GOOD")
          ? "Healthy"
          : rows.some((r) => r.status === "OVERDUE")
            ? "Attention required"
            : "Monitor",
    machines: rows,
  };
}

export async function listPmAuditLog(filters?: {
  machineId?: string;
  limit?: number;
}) {
  const limit = Math.min(Math.max(filters?.limit ?? 100, 1), 500);
  const rows = await prisma.machinePmAuditLog.findMany({
    where: filters?.machineId
      ? { machineId: normalizeMachineId(filters.machineId) }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map((r) => ({
    id: r.id,
    machineId: r.machineId,
    user: r.user,
    action: r.action,
    previousValue: r.previousValue,
    newValue: r.newValue,
    details: r.details,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function getPmReports() {
  await ensurePmFleetSeeded();
  const [summary, history, techNames] = await Promise.all([
    getPmDashboardSummary(),
    listPmHistory({ page: 1, pageSize: 200 }),
    prisma.machinePmHistory.findMany({
      select: { technician: true, laborMinutes: true, completedAt: true },
      orderBy: { completedAt: "desc" },
      take: 500,
    }),
  ]);

  const byTech = new Map<
    string,
    { completions: number; laborTotal: number; laborCount: number }
  >();
  for (const h of techNames) {
    const cur = byTech.get(h.technician) ?? {
      completions: 0,
      laborTotal: 0,
      laborCount: 0,
    };
    cur.completions += 1;
    if (h.laborMinutes != null) {
      cur.laborTotal += h.laborMinutes;
      cur.laborCount += 1;
    }
    byTech.set(h.technician, cur);
  }

  return {
    completionSummary: summary,
    recentHistory: history.rows.slice(0, 50),
    technicianActivity: [...byTech.entries()].map(([technician, v]) => ({
      technician,
      completions: v.completions,
      averageLaborMinutes:
        v.laborCount === 0
          ? null
          : Math.round(v.laborTotal / v.laborCount),
    })),
    qualityScoreFormula: PM_QUALITY_SCORE_FORMULA,
    customerSummary: await buildCustomerSummaryRows(),
  };
}

async function buildCustomerSummaryRows() {
  const rows = await listPmDashboardRows({ activeOnly: true });
  const map = new Map<
    string,
    { total: number; due: number; overdue: number; good: number }
  >();
  for (const r of rows) {
    const name = r.customerName ?? "Unknown";
    const cur = map.get(name) ?? { total: 0, due: 0, overdue: 0, good: 0 };
    cur.total += 1;
    if (r.status === "DUE") cur.due += 1;
    if (r.status === "OVERDUE") cur.overdue += 1;
    if (r.status === "GOOD") cur.good += 1;
    map.set(name, cur);
  }
  return [...map.entries()]
    .map(([customerName, v]) => ({ customerName, ...v }))
    .sort((a, b) => b.overdue - a.overdue || b.due - a.due);
}

/**
 * Auditable correction of notes / work performed on a completed PM.
 * Does not rewrite frozen meter, interval, checklist snapshot, or quality score
 * unless explicitly provided — preserves historical integrity.
 */
export async function correctPmHistory(input: {
  historyId: string;
  actor: string;
  notes?: string;
  workPerformed?: string;
}): Promise<
  | { ok: true; record: NonNullable<Awaited<ReturnType<typeof getPmHistoryById>>> }
  | { ok: false; error: string }
> {
  const existing = await prisma.machinePmHistory.findUnique({
    where: { id: input.historyId },
  });
  if (!existing) return { ok: false, error: "PM history record not found." };

  const previousValue = JSON.stringify({
    notes: existing.notes,
    workPerformed: existing.workPerformed,
  });
  const updated = await prisma.machinePmHistory.update({
    where: { id: input.historyId },
    data: {
      notes:
        input.notes === undefined ? existing.notes : input.notes.trim() || null,
      workPerformed:
        input.workPerformed === undefined
          ? existing.workPerformed
          : input.workPerformed.trim() || null,
      updatedAt: new Date(),
    },
  });

  await writePmAudit(prisma, {
    machineId: existing.machineId,
    user: input.actor,
    action: "PM_CORRECTED",
    previousValue,
    newValue: JSON.stringify({
      notes: updated.notes,
      workPerformed: updated.workPerformed,
    }),
    details: `historyId=${existing.id}`,
  });

  const record = await getPmHistoryById(existing.id);
  if (!record) return { ok: false, error: "PM history record not found." };
  return { ok: true, record };
}
