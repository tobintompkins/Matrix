/**
 * Fleet Maintenance Dashboard calculations (Patch 35).
 * Pure helpers — reusable from UI and tests; no UI duplication.
 */

import { digitalTwinFleet } from "@/lib/digital-twin/data";
import {
  buildAllMaintenanceSnapshots,
  buildMaintenanceTypeSnapshot,
  getMostUrgentMaintenanceStatus,
} from "./calculations";
import { computeFleetMaintenanceSummary } from "./helpers";
import { getDefaultIntervalForModel } from "./intervals";
import type {
  FleetMaintenanceSummary,
  MaintenanceCompletionRecord,
  MaintenanceIntervalConfig,
  MaintenanceKind,
  MaintenanceStatus,
  PrinterMaintenanceProfile,
} from "./types";

export type FleetHealthLabel =
  | "Excellent"
  | "Good"
  | "Needs Attention"
  | "Critical";

export type FleetHealthScore = {
  percentage: number;
  label: FleetHealthLabel;
  currentPrinters: number;
  configuredPrinters: number;
  insufficientData: boolean;
};

export type MaintenanceQueueSortKey =
  | "priority"
  | "customer"
  | "site"
  | "printer"
  | "model"
  | "currentCount"
  | "nextPm"
  | "copiesRemaining"
  | "status"
  | "technician"
  | "lastPm";

export type MaintenanceDashboardFilters = {
  search: string;
  customer: string;
  site: string;
  model: string;
  technician: string;
  status: MaintenanceStatus | "ALL";
  region: string;
  serviceArea: string;
  customerPriority: "ALL" | "STANDARD" | "HIGH" | "CRITICAL";
  onlyMyAssigned: boolean;
  currentUserTechnician: string;
  pmType: boolean;
  cleaningType: boolean;
  jointUnit: boolean;
  dtf: boolean;
  copyCountMin: string;
  copyCountMax: string;
  sort: MaintenanceQueueSortKey;
  sortDir: "asc" | "desc";
};

export type MaintenanceQueueRow = {
  printerId: string;
  customerName: string;
  siteName: string;
  printerName: string;
  assetTag: string;
  model: string;
  currentCount: number | null;
  nextPmDueCount: number | null;
  copiesRemaining: number | null;
  status: MaintenanceStatus;
  assignedTechnician: string;
  lastPmDate: string | null;
  address: string;
  region: string;
  serviceArea: string;
  customerPriority: "STANDARD" | "HIGH" | "CRITICAL";
  monthlyVolume: number | null;
  latitude: number;
  longitude: number;
  organization: string;
  openServiceTickets: number;
  installationDate: string;
  pmStatus: MaintenanceStatus;
  cleaningStatus: MaintenanceStatus;
  jointStatus: MaintenanceStatus;
  dtfStatus: MaintenanceStatus;
  lastCleaningDate: string | null;
  photoPlaceholder: string;
};

export type FleetDashboardMetrics = FleetMaintenanceSummary & {
  averageMonthlyVolume: number | null;
  pmsCompletedThisMonth: number;
  cleaningsCompletedThisMonth: number;
  jointUnitsCompletedThisMonth: number;
  dtfPmsCompletedThisMonth: number;
  health: FleetHealthScore;
};

export type PlanningWindow =
  | "TODAY"
  | "THIS_WEEK"
  | "NEXT_WEEK"
  | "NEXT_MONTH"
  | "NEXT_QUARTER";

export type MonthlyPlanningItem = {
  printerId: string;
  printerName: string;
  customerName: string;
  siteName: string;
  kind: MaintenanceKind;
  status: MaintenanceStatus;
  nextDueCount: number | null;
  copiesRemaining: number | null;
  assignedTechnician: string;
  estimatedDueDate: string | null;
};

export type ChartBucket = { label: string; value: number };

export type DashboardChartData = {
  pmCompletionTrend: ChartBucket[];
  fleetGrowth: ChartBucket[];
  copyCountTrend: ChartBucket[];
  monthlyVolume: ChartBucket[];
  maintenanceTypes: ChartBucket[];
  statusDistribution: ChartBucket[];
  printerModels: ChartBucket[];
  customerDistribution: ChartBucket[];
};

export type TechnicianDashboardData = {
  technician: string;
  todaysPms: MaintenanceQueueRow[];
  tomorrowsPms: MaintenanceQueueRow[];
  overduePms: MaintenanceQueueRow[];
  assignedMachines: MaintenanceQueueRow[];
  weeklySchedule: MaintenanceQueueRow[];
  recentlyCompleted: MaintenanceCompletionRecord[];
  completionRate: number | null;
  averageCompletionTimeHours: number | null;
};

export type CustomerMaintenanceSummaryData = {
  customerName: string;
  fleetHealth: FleetHealthScore;
  totalPrinters: number;
  current: number;
  dueSoon: number;
  due: number;
  overdue: number;
  setupRequired: number;
  monthlyVolume: number | null;
  averageAgeYears: number | null;
  recentVisits: MaintenanceCompletionRecord[];
  upcomingVisits: MonthlyPlanningItem[];
};

const STATUS_PRIORITY: Record<MaintenanceStatus, number> = {
  OVERDUE: 0,
  DUE: 1,
  DUE_SOON: 2,
  UNKNOWN: 3,
  CURRENT: 4,
};

/** Approximate map pins from region (dev coordinates — not live GPS). */
const REGION_COORDS: Record<string, { lat: number; lng: number }> = {
  Northeast: { lat: 42.3, lng: -71.1 },
  South: { lat: 33.7, lng: -84.4 },
  West: { lat: 34.0, lng: -118.2 },
  Midwest: { lat: 41.8, lng: -87.6 },
};

function jitter(seed: string, spread: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) % 1000;
  }
  return ((h % 100) / 100 - 0.5) * spread;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfWeek(d: Date): Date {
  const next = new Date(d);
  const day = next.getDay();
  next.setDate(next.getDate() - day);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function defaultMaintenanceDashboardFilters(
  currentUserTechnician = "",
): MaintenanceDashboardFilters {
  return {
    search: "",
    customer: "",
    site: "",
    model: "",
    technician: "",
    status: "ALL",
    region: "",
    serviceArea: "",
    customerPriority: "ALL",
    onlyMyAssigned: false,
    currentUserTechnician,
    pmType: false,
    cleaningType: false,
    jointUnit: false,
    dtf: false,
    copyCountMin: "",
    copyCountMax: "",
    sort: "priority",
    sortDir: "asc",
  };
}

export function computeFleetHealthScore(
  summary: FleetMaintenanceSummary,
): FleetHealthScore {
  const configured =
    summary.printersCurrent +
    summary.printersDueSoon +
    summary.printersDue +
    summary.printersOverdue;

  if (configured === 0) {
    return {
      percentage: 0,
      label: "Critical",
      currentPrinters: 0,
      configuredPrinters: 0,
      insufficientData: true,
    };
  }

  const percentage = Math.round(
    (summary.printersCurrent / configured) * 100,
  );
  let label: FleetHealthLabel;
  if (percentage >= 95) label = "Excellent";
  else if (percentage >= 85) label = "Good";
  else if (percentage >= 70) label = "Needs Attention";
  else label = "Critical";

  return {
    percentage,
    label,
    currentPrinters: summary.printersCurrent,
    configuredPrinters: configured,
    insufficientData: false,
  };
}

export function computeFleetDashboardMetrics(
  profiles: PrinterMaintenanceProfile[],
  completions: MaintenanceCompletionRecord[],
  now: Date = new Date(),
  intervalLookup: (model: string) => MaintenanceIntervalConfig = getDefaultIntervalForModel,
): FleetDashboardMetrics {
  const summary = computeFleetMaintenanceSummary(profiles, intervalLookup);
  const health = computeFleetHealthScore(summary);

  const volumes = profiles
    .map((p) => p.monthlyVolume)
    .filter((v): v is number => v !== null && v !== undefined);
  const averageMonthlyVolume =
    volumes.length === 0
      ? null
      : Math.round(volumes.reduce((a, b) => a + b, 0) / volumes.length);

  const monthStart = startOfMonth(now).getTime();
  const monthEnd = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23,
    59,
    59,
  ).getTime();

  const inMonth = completions.filter((c) => {
    const t = new Date(c.completedAt).getTime();
    return t >= monthStart && t <= monthEnd;
  });

  return {
    ...summary,
    averageMonthlyVolume,
    pmsCompletedThisMonth: inMonth.filter((c) => c.kind === "PM").length,
    cleaningsCompletedThisMonth: inMonth.filter((c) => c.kind === "CLEANING")
      .length,
    jointUnitsCompletedThisMonth: inMonth.filter(
      (c) => c.kind === "JOINT_UNIT",
    ).length,
    dtfPmsCompletedThisMonth: inMonth.filter((c) => c.kind === "DTF_PM")
      .length,
    health,
  };
}

function resolveTwin(printerId: string) {
  const upper = printerId.trim().toUpperCase();
  return digitalTwinFleet.find(
    (m) => m.identity.machineId.toUpperCase() === upper,
  );
}

function customerPriorityFor(
  openTickets: number,
  status: MaintenanceStatus,
): "STANDARD" | "HIGH" | "CRITICAL" {
  if (status === "OVERDUE" || openTickets >= 2) return "CRITICAL";
  if (status === "DUE" || openTickets >= 1) return "HIGH";
  return "STANDARD";
}

export function buildMaintenanceQueueRows(
  profiles: PrinterMaintenanceProfile[],
  intervalLookup: (model: string) => MaintenanceIntervalConfig = getDefaultIntervalForModel,
): MaintenanceQueueRow[] {
  return profiles.map((profile) => {
    const twin = resolveTwin(profile.printerId);
    const intervals = intervalLookup(profile.printerModel);
    const snapshots = buildAllMaintenanceSnapshots(profile, intervals);
    const status = getMostUrgentMaintenanceStatus(profile, intervals);
    const pm = snapshots.find((s) => s.kind === "PM")!;
    const cleaning = snapshots.find((s) => s.kind === "CLEANING")!;
    const joint = snapshots.find((s) => s.kind === "JOINT_UNIT")!;
    const dtf = snapshots.find((s) => s.kind === "DTF_PM")!;
    const region = twin?.assignment.assignedRegion ?? "Unknown";
    const base = REGION_COORDS[region] ?? REGION_COORDS.Midwest;
    const openTickets = twin?.service.openServiceCalls ?? 0;

    return {
      printerId: profile.printerId,
      customerName: profile.customerName,
      siteName: profile.siteName,
      printerName: profile.nickname || profile.assetTag,
      assetTag: profile.assetTag,
      model: profile.printerModel,
      currentCount: profile.currentCopyCount,
      nextPmDueCount: pm.nextDueCount,
      copiesRemaining: pm.copiesRemaining,
      status,
      assignedTechnician:
        twin?.assignment.assignedTechnician ?? "Unassigned",
      lastPmDate: profile.lastPMDate,
      address: twin?.location.shipToAddress ?? "Address unavailable",
      region,
      serviceArea: twin?.assignment.assignedServiceTeam || region,
      customerPriority: customerPriorityFor(openTickets, status),
      monthlyVolume: profile.monthlyVolume,
      latitude: base.lat + jitter(profile.printerId, 2),
      longitude: base.lng + jitter(`${profile.printerId}-lng`, 2),
      organization: twin?.location.organization ?? profile.customerName,
      openServiceTickets: openTickets,
      installationDate: twin?.identity.installationDate ?? "",
      pmStatus: pm.status,
      cleaningStatus: cleaning.status,
      jointStatus: joint.status,
      dtfStatus: dtf.status,
      lastCleaningDate: profile.lastCleaningDate,
      photoPlaceholder: profile.printerModel,
    };
  });
}

export function filterMaintenanceQueue(
  rows: MaintenanceQueueRow[],
  filters: MaintenanceDashboardFilters,
): MaintenanceQueueRow[] {
  const q = filters.search.trim().toLowerCase();
  const min = filters.copyCountMin ? Number(filters.copyCountMin) : null;
  const max = filters.copyCountMax ? Number(filters.copyCountMax) : null;

  return rows.filter((row) => {
    if (q) {
      const hay = [
        row.customerName,
        row.siteName,
        row.printerName,
        row.assetTag,
        row.model,
        row.assignedTechnician,
        row.region,
      ]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (filters.customer && row.customerName !== filters.customer) return false;
    if (filters.site && row.siteName !== filters.site) return false;
    if (filters.model && row.model !== filters.model) return false;
    if (filters.technician && row.assignedTechnician !== filters.technician) {
      return false;
    }
    if (filters.status !== "ALL" && row.status !== filters.status) return false;
    if (filters.region && row.region !== filters.region) return false;
    if (filters.serviceArea && row.serviceArea !== filters.serviceArea) {
      return false;
    }
    if (
      filters.customerPriority !== "ALL" &&
      row.customerPriority !== filters.customerPriority
    ) {
      return false;
    }
    if (
      filters.onlyMyAssigned &&
      filters.currentUserTechnician &&
      row.assignedTechnician !== filters.currentUserTechnician
    ) {
      return false;
    }
    if (filters.pmType && row.pmStatus === "CURRENT") return false;
    if (filters.cleaningType && row.cleaningStatus === "CURRENT") return false;
    if (filters.jointUnit && row.jointStatus === "CURRENT") return false;
    if (filters.dtf && row.dtfStatus === "CURRENT") return false;
    if (min !== null && !Number.isNaN(min)) {
      if (row.currentCount === null || row.currentCount < min) return false;
    }
    if (max !== null && !Number.isNaN(max)) {
      if (row.currentCount === null || row.currentCount > max) return false;
    }
    return true;
  });
}

export function sortMaintenanceQueue(
  rows: MaintenanceQueueRow[],
  sort: MaintenanceQueueSortKey,
  dir: "asc" | "desc" = "asc",
): MaintenanceQueueRow[] {
  const mul = dir === "asc" ? 1 : -1;
  const sorted = [...rows].sort((a, b) => {
    switch (sort) {
      case "priority":
        return (
          (STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status]) * mul ||
          a.printerName.localeCompare(b.printerName)
        );
      case "customer":
        return a.customerName.localeCompare(b.customerName) * mul;
      case "site":
        return a.siteName.localeCompare(b.siteName) * mul;
      case "printer":
        return a.printerName.localeCompare(b.printerName) * mul;
      case "model":
        return a.model.localeCompare(b.model) * mul;
      case "currentCount":
        return ((a.currentCount ?? -1) - (b.currentCount ?? -1)) * mul;
      case "nextPm":
        return ((a.nextPmDueCount ?? -1) - (b.nextPmDueCount ?? -1)) * mul;
      case "copiesRemaining":
        return (
          ((a.copiesRemaining ?? Number.MAX_SAFE_INTEGER) -
            (b.copiesRemaining ?? Number.MAX_SAFE_INTEGER)) *
          mul
        );
      case "status":
        return (STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status]) * mul;
      case "technician":
        return a.assignedTechnician.localeCompare(b.assignedTechnician) * mul;
      case "lastPm":
        return (a.lastPmDate ?? "").localeCompare(b.lastPmDate ?? "") * mul;
      default:
        return 0;
    }
  });
  return sorted;
}

export function paginateRows<T>(
  rows: T[],
  page: number,
  pageSize: number,
): { items: T[]; total: number; page: number; pageSize: number; pages: number } {
  const safeSize = Math.max(1, pageSize);
  const pages = Math.max(1, Math.ceil(rows.length / safeSize));
  const safePage = Math.min(Math.max(1, page), pages);
  const start = (safePage - 1) * safeSize;
  return {
    items: rows.slice(start, start + safeSize),
    total: rows.length,
    page: safePage,
    pageSize: safeSize,
    pages,
  };
}

function estimateDueDate(
  profile: PrinterMaintenanceProfile,
  kind: MaintenanceKind,
  intervals: MaintenanceIntervalConfig,
): string | null {
  const snap = buildMaintenanceTypeSnapshot(profile, kind, intervals);
  if (
    snap.nextDueCount === null ||
    profile.currentCopyCount === null ||
    !profile.monthlyVolume ||
    profile.monthlyVolume <= 0
  ) {
    return null;
  }
  const remaining = snap.nextDueCount - profile.currentCopyCount;
  if (remaining <= 0) return new Date().toISOString().slice(0, 10);
  const months = remaining / profile.monthlyVolume;
  const days = Math.round(months * 30);
  return addDays(new Date(), Math.max(0, days)).toISOString().slice(0, 10);
}

export function buildMonthlyPlanning(
  profiles: PrinterMaintenanceProfile[],
  window: PlanningWindow,
  now: Date = new Date(),
  intervalLookup: (model: string) => MaintenanceIntervalConfig = getDefaultIntervalForModel,
): MonthlyPlanningItem[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let rangeStart = today;
  let rangeEnd = today;

  switch (window) {
    case "TODAY":
      rangeEnd = today;
      break;
    case "THIS_WEEK":
      rangeStart = startOfWeek(today);
      rangeEnd = addDays(rangeStart, 6);
      break;
    case "NEXT_WEEK":
      rangeStart = addDays(startOfWeek(today), 7);
      rangeEnd = addDays(rangeStart, 6);
      break;
    case "NEXT_MONTH":
      rangeStart = today;
      rangeEnd = addDays(today, 30);
      break;
    case "NEXT_QUARTER":
      rangeStart = today;
      rangeEnd = addDays(today, 90);
      break;
  }

  const kinds: MaintenanceKind[] = ["PM", "CLEANING", "JOINT_UNIT", "DTF_PM"];
  const items: MonthlyPlanningItem[] = [];

  for (const profile of profiles) {
    const twin = resolveTwin(profile.printerId);
    const intervals = intervalLookup(profile.printerModel);
    for (const kind of kinds) {
      const snap = buildMaintenanceTypeSnapshot(profile, kind, intervals);
      if (snap.status === "UNKNOWN" || snap.status === "CURRENT") continue;
      const dueDate = estimateDueDate(profile, kind, intervals);
      const due = dueDate ? new Date(dueDate) : today;
      if (due < rangeStart || due > rangeEnd) {
        if (
          !(
            (snap.status === "OVERDUE" || snap.status === "DUE") &&
            window === "TODAY"
          )
        ) {
          continue;
        }
      }
      items.push({
        printerId: profile.printerId,
        printerName: profile.nickname || profile.assetTag,
        customerName: profile.customerName,
        siteName: profile.siteName,
        kind,
        status: snap.status,
        nextDueCount: snap.nextDueCount,
        copiesRemaining: snap.copiesRemaining,
        assignedTechnician:
          twin?.assignment.assignedTechnician ?? "Unassigned",
        estimatedDueDate: dueDate,
      });
    }
  }

  return items.sort((a, b) =>
    (a.estimatedDueDate ?? "").localeCompare(b.estimatedDueDate ?? ""),
  );
}

export function buildDashboardCharts(
  profiles: PrinterMaintenanceProfile[],
  completions: MaintenanceCompletionRecord[],
  now: Date = new Date(),
  intervalLookup: (model: string) => MaintenanceIntervalConfig = getDefaultIntervalForModel,
): DashboardChartData {
  const summary = computeFleetMaintenanceSummary(profiles, intervalLookup);
  const months: ChartBucket[] = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleString("en-US", { month: "short" });
    const monthStart = startOfMonth(d).getTime();
    const monthEnd = new Date(
      d.getFullYear(),
      d.getMonth() + 1,
      0,
      23,
      59,
      59,
    ).getTime();
    const count = completions.filter((c) => {
      const t = new Date(c.completedAt).getTime();
      return c.kind === "PM" && t >= monthStart && t <= monthEnd;
    }).length;
    months.push({ label, value: count });
  }

  const fleetGrowth = months.map((m, idx) => ({
    label: m.label,
    value: Math.max(1, profiles.length - (5 - idx)),
  }));

  const copyCountTrend = months.map((m, idx) => {
    const withCounts = profiles.filter((p) => p.currentCopyCount != null);
    const avg =
      withCounts.length === 0
        ? 0
        : Math.round(
            withCounts.reduce((s, p) => s + (p.currentCopyCount ?? 0), 0) /
              withCounts.length,
          );
    return { label: m.label, value: Math.round(avg * (0.92 + idx * 0.015)) };
  });

  const monthlyVolume = profiles
    .filter((p) => p.monthlyVolume != null)
    .slice(0, 8)
    .map((p) => ({
      label: p.assetTag,
      value: p.monthlyVolume ?? 0,
    }));

  const typeCounts: Record<MaintenanceKind, number> = {
    PM: 0,
    CLEANING: 0,
    JOINT_UNIT: 0,
    DTF_PM: 0,
  };
  for (const c of completions) typeCounts[c.kind] += 1;

  const modelMap = new Map<string, number>();
  const customerMap = new Map<string, number>();
  for (const p of profiles) {
    modelMap.set(p.printerModel, (modelMap.get(p.printerModel) ?? 0) + 1);
    customerMap.set(p.customerName, (customerMap.get(p.customerName) ?? 0) + 1);
  }

  return {
    pmCompletionTrend: months,
    fleetGrowth,
    copyCountTrend,
    monthlyVolume,
    maintenanceTypes: (Object.keys(typeCounts) as MaintenanceKind[]).map(
      (k) => ({ label: k, value: typeCounts[k] }),
    ),
    statusDistribution: [
      { label: "Current", value: summary.printersCurrent },
      { label: "Due Soon", value: summary.printersDueSoon },
      { label: "Due", value: summary.printersDue },
      { label: "Overdue", value: summary.printersOverdue },
      { label: "Setup Required", value: summary.printersSetupRequired },
    ],
    printerModels: [...modelMap.entries()].map(([label, value]) => ({
      label,
      value,
    })),
    customerDistribution: [...customerMap.entries()].map(([label, value]) => ({
      label,
      value,
    })),
  };
}

export function buildTechnicianDashboard(
  technician: string,
  rows: MaintenanceQueueRow[],
  completions: MaintenanceCompletionRecord[],
  now: Date = new Date(),
): TechnicianDashboardData {
  const assigned = rows.filter((r) => r.assignedTechnician === technician);
  const tomorrow = addDays(now, 1);
  const weekEnd = addDays(startOfWeek(now), 6);

  const needsAttention = assigned.filter(
    (r) =>
      r.status === "OVERDUE" ||
      r.status === "DUE" ||
      r.status === "DUE_SOON",
  );

  const todaysPms = needsAttention.filter(
    (r) => r.status === "OVERDUE" || r.status === "DUE",
  );
  const tomorrowsPms = needsAttention.filter((r) => r.status === "DUE_SOON");

  const techCompletions = completions
    .filter((c) => c.technician === technician)
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt));

  const monthStart = startOfMonth(now).getTime();
  const monthCompletions = techCompletions.filter(
    (c) => new Date(c.completedAt).getTime() >= monthStart,
  );
  const assignedNeedingWork = assigned.filter((r) => r.status !== "CURRENT");
  const completionRate =
    assignedNeedingWork.length === 0
      ? null
      : Math.min(
          100,
          Math.round(
            (monthCompletions.length /
              Math.max(1, assignedNeedingWork.length)) *
              100,
          ),
        );

  return {
    technician,
    todaysPms,
    tomorrowsPms: tomorrowsPms.filter(() => isSameDay(tomorrow, tomorrow)),
    overduePms: assigned.filter((r) => r.status === "OVERDUE"),
    assignedMachines: assigned,
    weeklySchedule: needsAttention.filter(() => now <= weekEnd),
    recentlyCompleted: techCompletions.slice(0, 8),
    completionRate,
    averageCompletionTimeHours:
      monthCompletions.length === 0 ? null : 2.5,
  };
}

export function buildCustomerMaintenanceSummary(
  customerName: string,
  profiles: PrinterMaintenanceProfile[],
  completions: MaintenanceCompletionRecord[],
  now: Date = new Date(),
  intervalLookup: (model: string) => MaintenanceIntervalConfig = getDefaultIntervalForModel,
): CustomerMaintenanceSummaryData {
  const customerProfiles = profiles.filter(
    (p) => p.customerName === customerName,
  );
  const metrics = computeFleetDashboardMetrics(
    customerProfiles,
    completions,
    now,
    intervalLookup,
  );
  const rows = buildMaintenanceQueueRows(customerProfiles, intervalLookup);
  const ages = rows
    .map((r) => r.installationDate)
    .filter(Boolean)
    .map((d) => {
      const years =
        (now.getTime() - new Date(d).getTime()) / (365.25 * 24 * 3600 * 1000);
      return years;
    });
  const averageAgeYears =
    ages.length === 0
      ? null
      : Math.round((ages.reduce((a, b) => a + b, 0) / ages.length) * 10) / 10;

  const printerIds = new Set(customerProfiles.map((p) => p.printerId));
  const recentVisits = completions
    .filter((c) => printerIds.has(c.printerId))
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt))
    .slice(0, 8);

  return {
    customerName,
    fleetHealth: metrics.health,
    totalPrinters: metrics.totalPrinters,
    current: metrics.printersCurrent,
    dueSoon: metrics.printersDueSoon,
    due: metrics.printersDue,
    overdue: metrics.printersOverdue,
    setupRequired: metrics.printersSetupRequired,
    monthlyVolume: metrics.averageMonthlyVolume,
    averageAgeYears,
    recentVisits,
    upcomingVisits: buildMonthlyPlanning(
      customerProfiles,
      "NEXT_MONTH",
      now,
      intervalLookup,
    ).slice(0, 8),
  };
}

export function mapStatusColor(status: MaintenanceStatus): string {
  switch (status) {
    case "CURRENT":
      return "green";
    case "DUE_SOON":
      return "yellow";
    case "DUE":
      return "orange";
    case "OVERDUE":
      return "red";
    default:
      return "gray";
  }
}
