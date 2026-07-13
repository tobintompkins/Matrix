/**
 * Printer health indicators & recommendations (Patch 36).
 */

import {
  buildAllMaintenanceSnapshots,
  getMostUrgentMaintenanceStatus,
} from "@/lib/maintenance/calculations";
import { getDefaultIntervalForModel } from "@/lib/maintenance/intervals";
import type {
  MaintenanceCompletionRecord,
  MaintenanceIntervalConfig,
  PrinterMaintenanceProfile,
} from "@/lib/maintenance/types";
import type {
  MaintenanceRecommendation,
  NotificationPriority,
  PrinterHealthIndicators,
} from "./types";

export function computeCopyVolumeTrend(
  previous: number | null,
  current: number | null,
  monthly: number | null,
): PrinterHealthIndicators["copyVolumeTrend"] {
  if (current === null || previous === null) return "Unknown";
  const delta = current - previous;
  if (monthly && monthly > 0) {
    const ratio = delta / monthly;
    if (ratio > 1.15) return "Rising";
    if (ratio < 0.85) return "Falling";
    return "Stable";
  }
  if (delta > 0) return "Rising";
  if (delta < 0) return "Falling";
  return "Stable";
}

export function computePrinterHealthIndicators(
  profile: PrinterMaintenanceProfile,
  completions: MaintenanceCompletionRecord[],
  openIssues = 0,
  intervals?: MaintenanceIntervalConfig,
): PrinterHealthIndicators {
  const config = intervals ?? getDefaultIntervalForModel(profile.printerModel);
  const snaps = buildAllMaintenanceSnapshots(profile, config);
  const known = snaps.filter((s) => s.status !== "UNKNOWN");
  const compliant = known.filter((s) => s.status === "CURRENT").length;
  const maintenanceCompliance =
    known.length === 0 ? 0 : Math.round((compliant / known.length) * 100);

  const urgent = getMostUrgentMaintenanceStatus(profile, config);
  let statusScore = 100;
  if (urgent === "DUE_SOON") statusScore = 80;
  else if (urgent === "DUE") statusScore = 55;
  else if (urgent === "OVERDUE") statusScore = 25;
  else if (urgent === "UNKNOWN") statusScore = 40;

  const printerCompletions = completions.filter(
    (c) => c.printerId === profile.printerId,
  );
  const recentRepairs = printerCompletions.length;
  const serviceHistoryScore = Math.min(
    100,
    40 + recentRepairs * 10 + (profile.lastPMDate ? 20 : 0),
  );

  const overallHealthScore = Math.round(
    statusScore * 0.5 +
      maintenanceCompliance * 0.3 +
      serviceHistoryScore * 0.15 +
      Math.max(0, 100 - openIssues * 15) * 0.05,
  );

  let band: PrinterHealthIndicators["band"];
  if (overallHealthScore >= 85) band = "Excellent";
  else if (overallHealthScore >= 70) band = "Good";
  else if (overallHealthScore >= 50) band = "Fair";
  else band = "Poor";

  return {
    printerId: profile.printerId,
    overallHealthScore,
    maintenanceCompliance,
    serviceHistoryScore,
    openIssues,
    recentRepairs,
    copyVolumeTrend: computeCopyVolumeTrend(
      profile.previousCopyCount,
      profile.currentCopyCount,
      profile.monthlyVolume,
    ),
    band,
  };
}

export function buildMaintenanceRecommendations(
  profile: PrinterMaintenanceProfile,
  intervals?: MaintenanceIntervalConfig,
): MaintenanceRecommendation[] {
  const config = intervals ?? getDefaultIntervalForModel(profile.printerModel);
  const snaps = buildAllMaintenanceSnapshots(profile, config);

  return snaps.map((snap) => {
    const recommended = snap.status !== "CURRENT" && snap.status !== "UNKNOWN";
    let urgency: NotificationPriority = "LOW";
    if (snap.status === "OVERDUE") urgency = "URGENT";
    else if (snap.status === "DUE") urgency = "HIGH";
    else if (snap.status === "DUE_SOON") urgency = "NORMAL";

    let explanation: string;
    if (snap.status === "UNKNOWN") {
      explanation =
        "No baseline on file — enter last completed counts before scheduling.";
    } else if (snap.status === "CURRENT") {
      explanation = `${snap.label} is within interval. Next due at ${
        snap.nextDueCount?.toLocaleString("en-US") ?? "—"
      } copies.`;
    } else if (snap.status === "OVERDUE") {
      explanation = `${snap.label} is overdue by ${
        snap.copiesOverdue?.toLocaleString("en-US") ?? "—"
      } copies based on the configured interval.`;
    } else {
      explanation = `${snap.label} should be planned soon — ${
        snap.copiesRemaining?.toLocaleString("en-US") ?? "—"
      } copies remaining until due.`;
    }

    return {
      kind: snap.kind,
      label: snap.label,
      recommended,
      urgency,
      explanation,
    };
  });
}
