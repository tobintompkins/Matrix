import type { CopyCountHistory, PrinterMaintenanceProfile } from "@/lib/maintenance";
import {
  buildMaintenanceTypeSnapshot,
  getMostUrgentMaintenanceStatus,
} from "@/lib/maintenance";
import { getDefaultIntervalForModel } from "@/lib/maintenance";
import {
  healthLabelFromScore,
  mapCleaningStatus,
  mapLegacyStatusToIntelligence,
} from "./status";
import type {
  CleaningScheduleRow,
  CleaningTypeId,
  ForecastConfidence,
  ForecastWindow,
  MachineHealthFactor,
  MachineHealthScore,
  MeterTableRow,
  PmDashboardMetrics,
  PmForecastItem,
  PmForecastSummary,
  PmIntelligenceFilters,
  PmIntelligenceStatus,
  PmIntervalRule,
  PmSettings,
} from "./types";
import { DEFAULT_PM_SETTINGS } from "./types";

export function averageDailyVolume(
  history: CopyCountHistory[],
  fallbackMonthly: number | null,
): number | null {
  if (history.length >= 2) {
    const sorted = [...history].sort((a, b) =>
      a.recordedAt.localeCompare(b.recordedAt),
    );
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const days = Math.max(
      1,
      (new Date(last.recordedAt).getTime() - new Date(first.recordedAt).getTime()) /
        86_400_000,
    );
    const delta = last.copyCount - first.copyCount;
    if (delta >= 0) return Math.round(delta / days);
  }
  if (fallbackMonthly != null && fallbackMonthly > 0) {
    return Math.round(fallbackMonthly / 30);
  }
  return null;
}

export function averageMonthlyVolume(
  daily: number | null,
  fallbackMonthly: number | null,
): number | null {
  if (daily != null) return Math.round(daily * 30);
  return fallbackMonthly;
}

export function estimatePmDate(
  impressionsRemaining: number | null,
  avgDaily: number | null,
  fromDate = new Date(),
): { date: string | null; confidence: ForecastConfidence } {
  if (impressionsRemaining == null) {
    return { date: null, confidence: "Low Confidence" };
  }
  if (impressionsRemaining <= 0) {
    return {
      date: fromDate.toISOString().slice(0, 10),
      confidence: "High Confidence",
    };
  }
  if (avgDaily == null || avgDaily <= 0) {
    return { date: null, confidence: "Low Confidence" };
  }
  const days = Math.ceil(impressionsRemaining / avgDaily);
  const d = new Date(fromDate);
  d.setDate(d.getDate() + days);
  const confidence: ForecastConfidence =
    days <= 45 ? "High Confidence" : days <= 120 ? "Moderate Confidence" : "Low Confidence";
  return { date: d.toISOString().slice(0, 10), confidence };
}

export function computeMachineHealthScore(
  profile: PrinterMaintenanceProfile,
  options?: {
    settings?: PmSettings;
    countAgeDays?: number | null;
    cleaningOverdue?: boolean;
    openOverdueWork?: boolean;
  },
): MachineHealthScore {
  const settings = options?.settings ?? DEFAULT_PM_SETTINGS;
  const w = settings.healthWeights;
  let score = 100;
  const factors: MachineHealthFactor[] = [];

  const interval = getDefaultIntervalForModel(profile.printerModel);
  const pmSnap = buildMaintenanceTypeSnapshot(profile, "PM", interval);
  const intel = mapLegacyStatusToIntelligence(pmSnap.status, {
    copiesRemaining: pmSnap.copiesRemaining,
    copiesOverdue: pmSnap.copiesOverdue,
    warningThreshold: interval.warningThreshold,
    criticalThreshold: settings.defaultCriticalThreshold,
    graceThreshold: settings.defaultGraceThreshold,
  });

  const pmPenalty =
    intel === "Healthy"
      ? 0
      : intel === "Monitor"
        ? 5
        : intel === "Due Soon"
          ? 12
          : intel === "Due" || intel === "Critical"
            ? 22
            : intel === "Overdue"
              ? 30
              : intel === "Severely Overdue"
                ? 40
                : 15;
  score -= (pmPenalty / 40) * w.pmStatus;
  factors.push({
    key: "pmStatus",
    label: "PM status",
    impact: -Math.round((pmPenalty / 40) * w.pmStatus),
    detail: `PM status is ${intel}`,
  });

  if (options?.cleaningOverdue) {
    score -= w.cleaningStatus;
    factors.push({
      key: "cleaning",
      label: "Cleaning overdue",
      impact: -w.cleaningStatus,
      detail: "One or more cleanings are overdue",
    });
  } else {
    factors.push({
      key: "cleaning",
      label: "Cleaning status",
      impact: 0,
      detail: "Cleanings are current or not applicable",
    });
  }

  const age = options?.countAgeDays;
  if (age != null && age > settings.countFreshnessDays) {
    const pen = Math.min(w.countFreshness, Math.round((age / settings.countFreshnessDays) * 8));
    score -= pen;
    factors.push({
      key: "freshness",
      label: "Count freshness",
      impact: -pen,
      detail: `Last meter count is ${age} days old`,
    });
  } else {
    factors.push({
      key: "freshness",
      label: "Count freshness",
      impact: 0,
      detail: "Meter count is recent",
    });
  }

  if (options?.openOverdueWork) {
    score -= w.overdueWork;
    factors.push({
      key: "overdueWork",
      label: "Overdue work orders",
      impact: -w.overdueWork,
      detail: "Open overdue service work",
    });
  }

  const volume = profile.monthlyVolume ?? 0;
  if (volume > 200_000) {
    const pen = Math.round(w.usageLevel * 0.6);
    score -= pen;
    factors.push({
      key: "usage",
      label: "High usage",
      impact: -pen,
      detail: `Monthly volume ${volume.toLocaleString()}`,
    });
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  return {
    printerId: profile.printerId,
    score,
    label: healthLabelFromScore(score),
    factors,
    calculatedAt: new Date().toISOString(),
  };
}

export function buildMeterTableRow(
  profile: PrinterMaintenanceProfile,
  history: CopyCountHistory[],
  settings: PmSettings = DEFAULT_PM_SETTINGS,
): MeterTableRow {
  const interval = getDefaultIntervalForModel(profile.printerModel);
  const pmSnap = buildMaintenanceTypeSnapshot(profile, "PM", interval);
  const cleaningSnap = buildMaintenanceTypeSnapshot(profile, "CLEANING", interval);
  const avgDaily = averageDailyVolume(history, profile.monthlyVolume);
  const avgMonthly = averageMonthlyVolume(avgDaily, profile.monthlyVolume);
  const remaining = pmSnap.copiesRemaining;
  const overdue = pmSnap.copiesOverdue;
  const impressionsRemaining =
    remaining != null ? remaining : overdue != null && overdue > 0 ? -overdue : null;
  const estimate = estimatePmDate(
    impressionsRemaining != null && impressionsRemaining > 0
      ? impressionsRemaining
      : impressionsRemaining,
    avgDaily,
  );
  const last = history[0] ?? null;
  const pmStatus = mapLegacyStatusToIntelligence(pmSnap.status, {
    copiesRemaining: pmSnap.copiesRemaining,
    copiesOverdue: pmSnap.copiesOverdue,
    warningThreshold: interval.warningThreshold,
    criticalThreshold: settings.defaultCriticalThreshold,
    graceThreshold: settings.defaultGraceThreshold,
  });

  return {
    printerId: profile.printerId,
    customerName: profile.customerName,
    siteName: profile.siteName,
    machineName: profile.nickname,
    assetNumber: profile.assetTag,
    serialNumber: profile.printerId,
    printerModel: profile.printerModel,
    currentMeter: profile.currentCopyCount,
    previousMeter: profile.previousCopyCount,
    countIncrease:
      profile.currentCopyCount != null && profile.previousCopyCount != null
        ? profile.currentCopyCount - profile.previousCopyCount
        : null,
    avgDailyVolume: avgDaily,
    avgMonthlyVolume: avgMonthly,
    lastCountDate: last?.recordedAt?.slice(0, 10) ?? profile.lastPMDate,
    countSource: last ? "Manual Entry" : null,
    enteredBy: last?.enteredBy ?? null,
    nextPmCount: pmSnap.nextDueCount,
    impressionsRemaining,
    estimatedPmDate: estimate.date,
    pmStatus,
    cleaningStatus: mapCleaningStatus(
      cleaningSnap.copiesRemaining ??
        (cleaningSnap.copiesOverdue != null ? -cleaningSnap.copiesOverdue : null),
      interval.warningThreshold,
    ),
  };
}

export function buildDashboardMetrics(
  rows: MeterTableRow[],
  cleaningRows: CleaningScheduleRow[],
  forecast30: PmForecastItem[],
  settings: PmSettings = DEFAULT_PM_SETTINGS,
): PmDashboardMetrics {
  const active = rows.filter((r) => r.pmStatus !== "Inactive Machine");
  const current = active.filter((r) =>
    ["Healthy", "Monitor", "Completed"].includes(r.pmStatus),
  ).length;
  const dueSoon = active.filter((r) => r.pmStatus === "Due Soon").length;
  const dueNow = active.filter((r) =>
    ["Due", "Critical"].includes(r.pmStatus),
  ).length;
  const overdue = active.filter((r) =>
    ["Overdue", "Severely Overdue"].includes(r.pmStatus),
  ).length;
  const compliant = active.filter(
    (r) => !["Overdue", "Severely Overdue", "Due", "Critical"].includes(r.pmStatus),
  ).length;
  const meterUpdatesNeeded = active.filter((r) => {
    if (!r.lastCountDate) return true;
    const age =
      (Date.now() - new Date(r.lastCountDate).getTime()) / 86_400_000;
    return age > settings.countFreshnessDays;
  }).length;

  return {
    totalActiveMachines: active.length,
    machinesCurrentOnPm: current,
    pmsDueSoon: dueSoon,
    pmsDueNow: dueNow,
    overduePms: overdue,
    dtfCleaningsDue: cleaningRows.filter(
      (c) => c.cleaningType === "DTF" && ["Due", "Due Soon", "Overdue"].includes(c.status),
    ).length,
    jointUnitCleaningsDue: cleaningRows.filter(
      (c) =>
        c.cleaningType === "JOINT_UNIT" &&
        ["Due", "Due Soon", "Overdue"].includes(c.status),
    ).length,
    meterUpdatesNeeded,
    pmCompliancePercent:
      active.length === 0 ? 100 : Math.round((compliant / active.length) * 100),
    estimatedPmsNext30Days: forecast30.filter((f) => f.kind === "PM").length,
  };
}

export function windowToDays(window: ForecastWindow): number {
  switch (window) {
    case "7d":
      return 7;
    case "14d":
      return 14;
    case "30d":
      return 30;
    case "60d":
      return 60;
    case "90d":
      return 90;
    case "6m":
      return 182;
    case "12m":
      return 365;
    default:
      return 30;
  }
}

export function buildForecast(
  rows: MeterTableRow[],
  cleaningRows: CleaningScheduleRow[],
  window: ForecastWindow,
  intervalRules: PmIntervalRule[],
): PmForecastSummary {
  const days = windowToDays(window);
  const end = new Date();
  end.setDate(end.getDate() + days);
  const endIso = end.toISOString().slice(0, 10);

  const items: PmForecastItem[] = [];

  for (const row of rows) {
    if (!row.estimatedPmDate) {
      if (row.impressionsRemaining != null && row.impressionsRemaining <= 0) {
        items.push({
          printerId: row.printerId,
          machineName: row.machineName,
          customerName: row.customerName,
          siteName: row.siteName,
          printerModel: row.printerModel,
          kind: "PM",
          estimatedDate: new Date().toISOString().slice(0, 10),
          estimatedMeter: row.nextPmCount,
          confidence: "High Confidence",
          estimatedLaborHours:
            intervalRules.find((r) => r.printerModel === row.printerModel)
              ?.estimatedLaborHours ?? 2,
          partsKitId:
            intervalRules.find((r) => r.printerModel === row.printerModel)
              ?.requiredPartsKitId ?? null,
          reason: "Already at or past PM count",
        });
      }
      continue;
    }
    if (row.estimatedPmDate <= endIso) {
      const rule = intervalRules.find((r) => r.printerModel === row.printerModel);
      items.push({
        printerId: row.printerId,
        machineName: row.machineName,
        customerName: row.customerName,
        siteName: row.siteName,
        printerModel: row.printerModel,
        kind: "PM",
        estimatedDate: row.estimatedPmDate,
        estimatedMeter: row.nextPmCount,
        confidence:
          row.avgDailyVolume != null && row.avgDailyVolume > 0
            ? "High Confidence"
            : "Low Confidence",
        estimatedLaborHours: rule?.estimatedLaborHours ?? 2,
        partsKitId: rule?.requiredPartsKitId ?? null,
        reason: "Projected from usage history",
      });
    }
  }

  for (const c of cleaningRows) {
    if (!c.nextCleaningDate) continue;
    if (c.nextCleaningDate > endIso) continue;
    if (!["Due", "Due Soon", "Overdue", "Current"].includes(c.status) && c.status !== "Scheduled") {
      // still include if date in window
    }
    items.push({
      printerId: c.printerId,
      machineName: c.machineName,
      customerName: c.customerName,
      siteName: c.siteName,
      printerModel: c.printerModel,
      kind: c.cleaningType === "DTF" ? "DTF" : c.cleaningType === "JOINT_UNIT" ? "JOINT_UNIT" : "CLEANING",
      estimatedDate: c.nextCleaningDate,
      estimatedMeter: c.nextCleaningCount,
      confidence: c.currentMeter != null ? "Moderate Confidence" : "Low Confidence",
      estimatedLaborHours: 1,
      partsKitId: null,
      reason: `${c.cleaningLabel} projected`,
    });
  }

  const byTech = new Map<string, { hours: number; jobs: number }>();
  const byCustomer = new Map<string, number>();
  const byModel = new Map<string, number>();

  for (const item of items) {
    const tech = "Unassigned";
    const t = byTech.get(tech) ?? { hours: 0, jobs: 0 };
    t.hours += item.estimatedLaborHours;
    t.jobs += 1;
    byTech.set(tech, t);
    byCustomer.set(item.customerName, (byCustomer.get(item.customerName) ?? 0) + 1);
    byModel.set(item.printerModel, (byModel.get(item.printerModel) ?? 0) + 1);
  }

  const windowLabels: Record<ForecastWindow, string> = {
    "7d": "Next 7 Days",
    "14d": "Next 14 Days",
    "30d": "Next 30 Days",
    "60d": "Next 60 Days",
    "90d": "Next 90 Days",
    "6m": "Next 6 Months",
    "12m": "Next 12 Months",
    custom: "Custom Range",
  };

  return {
    window,
    windowLabel: windowLabels[window],
    machinesReachingPm: items.filter((i) => i.kind === "PM").length,
    expectedDtfCleanings: items.filter((i) => i.kind === "DTF").length,
    expectedJointCleanings: items.filter((i) => i.kind === "JOINT_UNIT").length,
    estimatedLaborHours: Math.round(
      items.reduce((s, i) => s + i.estimatedLaborHours, 0) * 10,
    ) / 10,
    estimatedPartsDemand: [
      ...new Set(items.map((i) => i.partsKitId).filter(Boolean) as string[]),
    ],
    workloadByTechnician: [...byTech.entries()].map(([technician, v]) => ({
      technician,
      hours: v.hours,
      jobs: v.jobs,
    })),
    workloadByCustomer: [...byCustomer.entries()].map(([customer, jobs]) => ({
      customer,
      jobs,
    })),
    workloadByModel: [...byModel.entries()].map(([model, jobs]) => ({
      model,
      jobs,
    })),
    partsShortageRisks: [],
    items: items.sort((a, b) =>
      (a.estimatedDate ?? "9999").localeCompare(b.estimatedDate ?? "9999"),
    ),
  };
}

export function filterMeterRows(
  rows: MeterTableRow[],
  filters: Partial<PmIntelligenceFilters>,
): MeterTableRow[] {
  return rows.filter((r) => {
    if (filters.customer && filters.customer !== "ALL") {
      if (!r.customerName.toLowerCase().includes(filters.customer.toLowerCase())) {
        return false;
      }
    }
    if (filters.site && filters.site !== "ALL") {
      if (!r.siteName.toLowerCase().includes(filters.site.toLowerCase())) return false;
    }
    if (filters.printerModel && filters.printerModel !== "ALL") {
      if (r.printerModel !== filters.printerModel) return false;
    }
    if (filters.pmStatus && filters.pmStatus !== "ALL") {
      if (r.pmStatus !== filters.pmStatus) return false;
    }
    return true;
  });
}

export function buildCleaningRowsFromProfiles(
  profiles: PrinterMaintenanceProfile[],
): CleaningScheduleRow[] {
  const rows: CleaningScheduleRow[] = [];
  for (const p of profiles) {
    const interval = getDefaultIntervalForModel(p.printerModel);
    const kinds: Array<{ type: CleaningTypeId; label: string; kind: "CLEANING" | "JOINT_UNIT" | "DTF_PM" }> = [
      { type: "GENERAL", label: "General Preventive Cleaning", kind: "CLEANING" },
      { type: "JOINT_UNIT", label: "Joint Unit Cleaning", kind: "JOINT_UNIT" },
      { type: "DTF", label: "DTF Cleaning", kind: "DTF_PM" },
    ];
    for (const k of kinds) {
      const snap = buildMaintenanceTypeSnapshot(p, k.kind, interval);
      const remaining =
        snap.copiesRemaining ??
        (snap.copiesOverdue != null ? -snap.copiesOverdue : null);
      const avgDaily = p.monthlyVolume != null ? Math.round(p.monthlyVolume / 30) : null;
      const est = estimatePmDate(
        remaining != null && remaining > 0 ? remaining : remaining,
        avgDaily,
      );
      rows.push({
        id: `${p.printerId}-${k.type}`,
        printerId: p.printerId,
        customerName: p.customerName,
        siteName: p.siteName,
        machineName: p.nickname,
        printerModel: p.printerModel,
        cleaningType: k.type,
        cleaningLabel: k.label,
        lastCleaningCount:
          k.kind === "CLEANING"
            ? p.lastCleaningCopyCount
            : k.kind === "JOINT_UNIT"
              ? p.lastJointUnitCopyCount
              : p.lastDTFPMCopyCount,
        lastCleaningDate:
          k.kind === "CLEANING"
            ? p.lastCleaningDate
            : k.kind === "JOINT_UNIT"
              ? p.lastJointUnitDate
              : p.lastDTFPMDate,
        currentMeter: p.currentCopyCount,
        nextCleaningCount: snap.nextDueCount,
        nextCleaningDate: est.date,
        remainingCount: remaining,
        daysRemaining:
          est.date != null
            ? Math.ceil(
                (new Date(est.date).getTime() - Date.now()) / 86_400_000,
              )
            : null,
        assignedTechnician: null,
        status: mapCleaningStatus(remaining, interval.warningThreshold),
        notes: "",
      });
    }
  }
  return rows;
}

export function mostUrgentIntelligenceStatus(
  profile: PrinterMaintenanceProfile,
  settings: PmSettings = DEFAULT_PM_SETTINGS,
): PmIntelligenceStatus {
  const interval = getDefaultIntervalForModel(profile.printerModel);
  const urgent = getMostUrgentMaintenanceStatus(profile, interval);
  const snap = buildMaintenanceTypeSnapshot(profile, "PM", interval);
  return mapLegacyStatusToIntelligence(urgent, {
    copiesRemaining: snap.copiesRemaining,
    copiesOverdue: snap.copiesOverdue,
    warningThreshold: interval.warningThreshold,
    criticalThreshold: settings.defaultCriticalThreshold,
    graceThreshold: settings.defaultGraceThreshold,
  });
}
