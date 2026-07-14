"use client";

/**
 * Browser client for Patch 45/46 /api/pm routes.
 * Temporary UI filter state may live in sessionStorage; PM data comes from Prisma.
 */

import type { PmCleaningStatus } from "@/lib/maintenance/pm-status";
import type {
  PmDashboardRow,
  PmDashboardSummary,
} from "@/lib/maintenance/pm-prisma-repository";
import type {
  PmPartUsed,
  PmWorkflowChecklistItem,
} from "@/lib/maintenance/pm-checklist";

export type PmDashboardResponse = {
  ok: boolean;
  rows?: PmDashboardRow[];
  summary?: PmDashboardSummary;
  error?: string;
};

export type PmHistoryRow = {
  id: string;
  machineId: string;
  completedAt: string;
  countAtCompletion: number;
  previousPmCount: number | null;
  pmIntervalAtCompletion: number;
  technician: string;
  recordedBy: string | null;
  notes: string | null;
  idempotencyKey: string | null;
  customerName?: string | null;
  nickname?: string | null;
  serialOrAsset?: string | null;
  printerModel?: string | null;
  laborMinutes?: number | null;
  qualityScore?: number | null;
  checklistCompletionPct?: number | null;
  statusAtCompletion?: string | null;
  partsUsedJson?: string | null;
  timeStarted?: string | null;
  timeFinished?: string | null;
};

async function parseJson<T extends Record<string, unknown>>(
  res: Response,
): Promise<T & { ok: boolean; error?: string; idempotent?: boolean }> {
  const data = (await res.json()) as T & {
    ok: boolean;
    error?: string;
    idempotent?: boolean;
  };
  return data;
}

export async function fetchPmDashboard(params?: {
  status?: PmCleaningStatus | "ALL";
  search?: string;
  customerName?: string;
  assignedTechnician?: string;
}): Promise<PmDashboardResponse> {
  const sp = new URLSearchParams();
  if (params?.status && params.status !== "ALL") sp.set("status", params.status);
  if (params?.search) sp.set("search", params.search);
  if (params?.customerName) sp.set("customerName", params.customerName);
  if (params?.assignedTechnician) {
    sp.set("assignedTechnician", params.assignedTechnician);
  }
  const res = await fetch(`/api/pm/dashboard?${sp.toString()}`, {
    cache: "no-store",
  });
  return parseJson(res);
}

export async function fetchPmMachine(machineId: string) {
  const res = await fetch(`/api/pm/machines/${encodeURIComponent(machineId)}`, {
    cache: "no-store",
  });
  return parseJson<{
    ok: boolean;
    machine?: PmDashboardRow & {
      history: PmHistoryRow[];
      recentMeters: Array<{
        id: string;
        meterCount: number;
        previousCount: number | null;
        enteredBy: string | null;
        recordedAt: string;
        notes: string | null;
      }>;
      modelDefaultInterval: number | null;
    };
    error?: string;
  }>(res);
}

export async function postCompletePm(body: {
  machineId: string;
  countAtCompletion: number;
  technician: string;
  recordedBy?: string;
  notes?: string;
  completedAt?: string;
  idempotencyKey: string;
  pmInterval?: number;
  timeStarted?: string;
  timeFinished?: string;
  checklist?: PmWorkflowChecklistItem[];
  partsUsed?: PmPartUsed[];
  workPerformed?: string;
  customerSignaturePlaceholder?: string;
}) {
  const res = await fetch("/api/pm/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseJson<{
    ok: boolean;
    historyId?: string;
    qualityScore?: number;
  }>(res);
}

export async function postPmInterval(body: {
  machineId: string;
  interval: number | null;
  actor: string;
  dueSoonThreshold?: number | null;
}) {
  const res = await fetch("/api/pm/interval", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseJson(res);
}

export async function postPmMeter(body: {
  machineId: string;
  meterCount: number;
  enteredBy: string;
  notes?: string;
  lowerCountReason?: string;
  idempotencyKey?: string;
}) {
  const res = await fetch("/api/pm/meter", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseJson(res);
}

export async function fetchPmHistory(params?: {
  machineId?: string;
  technician?: string;
  search?: string;
  from?: string;
  to?: string;
  statusAtCompletion?: string;
  page?: number;
  pageSize?: number;
}): Promise<{
  ok: boolean;
  rows?: PmHistoryRow[];
  total?: number;
  page?: number;
  pageSize?: number;
  error?: string;
}> {
  const sp = new URLSearchParams();
  if (params?.machineId) sp.set("machineId", params.machineId);
  if (params?.technician) sp.set("technician", params.technician);
  if (params?.search) sp.set("search", params.search);
  if (params?.from) sp.set("from", params.from);
  if (params?.to) sp.set("to", params.to);
  if (params?.statusAtCompletion) {
    sp.set("statusAtCompletion", params.statusAtCompletion);
  }
  if (params?.page) sp.set("page", String(params.page));
  if (params?.pageSize) sp.set("pageSize", String(params.pageSize));
  const res = await fetch(`/api/pm/history?${sp.toString()}`, {
    cache: "no-store",
  });
  return parseJson(res);
}

export async function fetchPmHistoryRecord(historyId: string) {
  const res = await fetch(
    `/api/pm/history/${encodeURIComponent(historyId)}`,
    { cache: "no-store" },
  );
  return parseJson<{
    ok: boolean;
    record?: PmHistoryRow & {
      checklist: import("./pm-checklist").PmWorkflowChecklistItem[];
      partsUsed: import("./pm-checklist").PmPartUsed[];
      workPerformed?: string | null;
      customerSignaturePlaceholder?: string | null;
      checklistJson?: string | null;
    };
  }>(res);
}

export async function downloadPmHistoryCsv(params?: {
  technician?: string;
  from?: string;
  to?: string;
  search?: string;
  statusAtCompletion?: string;
}) {
  const sp = new URLSearchParams({ format: "csv" });
  if (params?.technician) sp.set("technician", params.technician);
  if (params?.from) sp.set("from", params.from);
  if (params?.to) sp.set("to", params.to);
  if (params?.search) sp.set("search", params.search);
  if (params?.statusAtCompletion) {
    sp.set("statusAtCompletion", params.statusAtCompletion);
  }
  const res = await fetch(`/api/pm/history?${sp.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Export failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "pm-history.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export async function fetchPmChecklist(printerModel?: string | null) {
  const sp = new URLSearchParams();
  if (printerModel) sp.set("printerModel", printerModel);
  const res = await fetch(`/api/pm/checklist?${sp.toString()}`, {
    cache: "no-store",
  });
  return parseJson<{ ok: boolean; checklist?: PmWorkflowChecklistItem[] }>(res);
}

export async function fetchPmDraft(machineId: string, technician: string) {
  const sp = new URLSearchParams({ machineId, technician });
  const res = await fetch(`/api/pm/draft?${sp.toString()}`, {
    cache: "no-store",
  });
  return parseJson<{
    ok: boolean;
    draft?: {
      id: string;
      checklist: PmWorkflowChecklistItem[];
      partsUsed: PmPartUsed[];
      notes: string | null;
      timeStarted: string | null;
      meterReading: number | null;
      updatedAt: string;
    } | null;
  }>(res);
}

export async function savePmDraftClient(body: {
  machineId: string;
  technician: string;
  checklist: PmWorkflowChecklistItem[];
  partsUsed?: PmPartUsed[];
  notes?: string;
  timeStarted?: string;
  meterReading?: number | null;
}) {
  const res = await fetch("/api/pm/draft", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseJson<{ ok: boolean; draftId?: string }>(res);
}

export async function fetchTechnicianPmDashboard(technician: string) {
  const sp = new URLSearchParams();
  if (technician) sp.set("technician", technician);
  const res = await fetch(`/api/pm/technician?${sp.toString()}`, {
    cache: "no-store",
  });
  return parseJson<{
    ok: boolean;
    scopedToSelf?: boolean;
    actorDisplayName?: string;
    data?: {
      technician: string;
      todaysPms: number;
      overduePms: number;
      duePms: number;
      dueSoonPms: number;
      completedToday: number;
      completedThisWeek: number;
      averagePmTimeMinutes: number | null;
      assignedMachines: PmDashboardRow[];
    };
  }>(res);
}

export async function fetchPmReports() {
  const res = await fetch("/api/pm/reports", { cache: "no-store" });
  return parseJson<{
    ok: boolean;
    data?: {
      completionSummary: PmDashboardSummary;
      recentHistory: PmHistoryRow[];
      technicianActivity: Array<{
        technician: string;
        completions: number;
        averageLaborMinutes: number | null;
      }>;
      qualityScoreFormula?: {
        version: string;
        weights: Record<string, number>;
        rules: readonly string[];
      };
      customerSummary?: Array<{
        customerName: string;
        total: number;
        due: number;
        overdue: number;
        good: number;
      }>;
    };
  }>(res);
}

export async function fetchCustomerPmSummary(customerName: string) {
  const sp = new URLSearchParams({ customerName });
  const res = await fetch(`/api/pm/customer?${sp.toString()}`, {
    cache: "no-store",
  });
  return parseJson<{
    ok: boolean;
    data?: {
      customerName: string;
      totalMachines: number;
      pmDue: number;
      pmOverdue: number;
      pmDueSoon: number;
      good: number;
      notConfigured: number;
      lastPmCompleted: string | null;
      lastPmTechnician: string | null;
      nextScheduledHint: {
        machineId: string;
        nickname: string | null;
        nextPmDueCount: number | null;
        countsRemaining: number | null;
        status: string;
      } | null;
      fleetHealth: string;
      machines: PmDashboardRow[];
    };
  }>(res);
}

export async function downloadPmReportsCsv(report?: string) {
  const sp = new URLSearchParams({ format: "csv" });
  if (report) sp.set("report", report);
  const res = await fetch(`/api/pm/reports?${sp.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Export failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pm-${report ?? "completion"}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function fetchPmAudit(machineId?: string) {
  const sp = new URLSearchParams();
  if (machineId) sp.set("machineId", machineId);
  const res = await fetch(`/api/pm/audit?${sp.toString()}`, {
    cache: "no-store",
  });
  return parseJson<{
    ok: boolean;
    rows?: Array<{
      id: string;
      machineId: string | null;
      user: string | null;
      action: string;
      previousValue: string | null;
      newValue: string | null;
      details: string | null;
      createdAt: string;
    }>;
  }>(res);
}

export async function lookupPmPart(partNumber: string) {
  const sp = new URLSearchParams({ partNumber });
  const res = await fetch(`/api/pm/parts?${sp.toString()}`, {
    cache: "no-store",
  });
  return parseJson<{
    ok: boolean;
    part?: {
      partId: string;
      partNumber: string;
      description: string;
    } | null;
  }>(res);
}

export function newIdempotencyKey(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
