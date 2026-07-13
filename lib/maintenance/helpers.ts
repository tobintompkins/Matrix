import {
  buildAllMaintenanceSnapshots,
  getMostUrgentMaintenanceStatus,
  toStatusDisplay,
} from "./calculations";
import { getDefaultIntervalForModel } from "./intervals";
import type {
  FleetCopyCountStats,
  FleetMaintenanceSummary,
  MaintenanceEventType,
  MaintenanceIntervalConfig,
  MaintenanceStatus,
  MaintenanceStatusDisplay,
  PrinterMaintenanceProfile,
} from "./types";

export function formatCopyCount(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("en-US");
}

export function formatMaintenanceDate(
  value: string | null | undefined,
): string {
  if (!value) return "No data yet";
  return value.slice(0, 10);
}

export function getMaintenanceEventLabel(type: MaintenanceEventType): string {
  switch (type) {
    case "COPY_COUNT_ENTERED":
      return "Copy Count Entered";
    case "PM_COMPLETED":
      return "PM Completed";
    case "CLEANING_COMPLETED":
      return "Cleaning Completed";
    case "JOINT_UNIT":
      return "Joint Unit PM";
    case "DTF_PM":
      return "DTF PM";
    case "BASELINE_CHANGED":
      return "Baseline Changed";
    case "INTERVAL_CHANGED":
      return "Interval Configuration Changed";
    case "MAINTENANCE_CORRECTED":
      return "Maintenance Corrected";
    default:
      return type;
  }
}

export function getMaintenanceStatusLabel(
  status: MaintenanceStatus,
): MaintenanceStatusDisplay {
  return toStatusDisplay(status);
}

/** Resolve printer id aliases (mx-gd-002 ↔ MX-GD-002). */
export function normalizePrinterId(printerId: string): string {
  return printerId.trim().toUpperCase();
}

export function computeFleetCopyCountStats(
  profiles: PrinterMaintenanceProfile[],
): FleetCopyCountStats {
  const summary = computeFleetMaintenanceSummary(profiles);
  return {
    highest: summary.highest,
    lowest: summary.lowest,
    averageFleetCount: summary.averageFleetCount,
    totalFleetCopies: summary.totalFleetCopies,
    machinesWithCounts: summary.machinesWithCounts,
  };
}

export function computeFleetMaintenanceSummary(
  profiles: PrinterMaintenanceProfile[],
  intervalLookup: (model: string) => MaintenanceIntervalConfig = getDefaultIntervalForModel,
): FleetMaintenanceSummary {
  const withCounts = profiles.filter(
    (p) => p.currentCopyCount !== null && p.currentCopyCount !== undefined,
  );

  let printersCurrent = 0;
  let printersDueSoon = 0;
  let printersDue = 0;
  let printersOverdue = 0;
  let printersSetupRequired = 0;

  for (const profile of profiles) {
    const urgent = getMostUrgentMaintenanceStatus(
      profile,
      intervalLookup(profile.printerModel),
    );
    switch (urgent) {
      case "OVERDUE":
        printersOverdue += 1;
        break;
      case "DUE":
        printersDue += 1;
        break;
      case "DUE_SOON":
        printersDueSoon += 1;
        break;
      case "UNKNOWN":
        printersSetupRequired += 1;
        break;
      case "CURRENT":
        printersCurrent += 1;
        break;
    }
  }

  if (withCounts.length === 0) {
    return {
      totalPrinters: profiles.length,
      printersCurrent,
      printersDueSoon,
      printersDue,
      printersOverdue,
      printersSetupRequired,
      highest: null,
      lowest: null,
      averageFleetCount: null,
      totalFleetCopies: null,
      machinesWithCounts: 0,
      insufficientData: true,
    };
  }

  const sorted = [...withCounts].sort(
    (a, b) => (b.currentCopyCount ?? 0) - (a.currentCopyCount ?? 0),
  );
  const highestProfile = sorted[0];
  const lowestProfile = sorted[sorted.length - 1];
  const total = withCounts.reduce(
    (sum, p) => sum + (p.currentCopyCount ?? 0),
    0,
  );

  return {
    totalPrinters: profiles.length,
    printersCurrent,
    printersDueSoon,
    printersDue,
    printersOverdue,
    printersSetupRequired,
    highest: {
      printerId: highestProfile.printerId,
      assetTag: highestProfile.assetTag,
      nickname: highestProfile.nickname,
      count: highestProfile.currentCopyCount ?? 0,
    },
    lowest: {
      printerId: lowestProfile.printerId,
      assetTag: lowestProfile.assetTag,
      nickname: lowestProfile.nickname,
      count: lowestProfile.currentCopyCount ?? 0,
    },
    averageFleetCount: Math.round(total / withCounts.length),
    totalFleetCopies: total,
    machinesWithCounts: withCounts.length,
    insufficientData: false,
  };
}

export function profileNeedsSetup(profile: PrinterMaintenanceProfile): boolean {
  return buildAllMaintenanceSnapshots(profile).every(
    (s) => s.status === "UNKNOWN",
  );
}
