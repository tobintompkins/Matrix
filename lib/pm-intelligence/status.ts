import type { MaintenanceStatus } from "@/lib/maintenance";
import type { CleaningStatus, PmIntelligenceStatus } from "./types";

/** Map legacy Patch 33–36 statuses into Patch 44 intelligence badges. */
export function mapLegacyStatusToIntelligence(
  status: MaintenanceStatus,
  options?: {
    copiesRemaining?: number | null;
    copiesOverdue?: number | null;
    warningThreshold?: number;
    criticalThreshold?: number;
    graceThreshold?: number;
    scheduled?: boolean;
    inProgress?: boolean;
    awaitingParts?: boolean;
    deferred?: boolean;
    inactive?: boolean;
  },
): PmIntelligenceStatus {
  if (options?.inactive) return "Inactive Machine";
  if (options?.deferred) return "Deferred";
  if (options?.awaitingParts) return "Awaiting Parts";
  if (options?.inProgress) return "In Progress";
  if (options?.scheduled) return "Scheduled";

  if (status === "UNKNOWN") return "Not Enough Data";

  const overdue = options?.copiesOverdue ?? 0;
  const remaining = options?.copiesRemaining ?? null;
  const warning = options?.warningThreshold ?? 75_000;
  const critical = options?.criticalThreshold ?? 25_000;
  const grace = options?.graceThreshold ?? 10_000;

  if (status === "OVERDUE") {
    if (overdue > grace) return "Severely Overdue";
    if (overdue > 0 && overdue <= critical) return "Critical";
    return "Overdue";
  }

  if (status === "DUE") return "Due";

  if (status === "DUE_SOON") {
    if (remaining != null && remaining <= critical) return "Critical";
    return "Due Soon";
  }

  // CURRENT
  if (remaining != null && remaining <= warning * 1.5 && remaining > warning) {
    return "Monitor";
  }
  return "Healthy";
}

export function intelligenceStatusToVariant(
  status: PmIntelligenceStatus,
): "completed" | "warning" | "error" | "active" | "offline" | "waiting-parts" {
  switch (status) {
    case "Healthy":
    case "Completed":
      return "completed";
    case "Monitor":
    case "Due Soon":
    case "Scheduled":
      return "warning";
    case "Due":
    case "Critical":
    case "Overdue":
    case "Severely Overdue":
      return "error";
    case "In Progress":
      return "active";
    case "Awaiting Parts":
      return "waiting-parts";
    default:
      return "offline";
  }
}

export function mapCleaningStatus(
  remaining: number | null,
  warningThreshold: number,
): CleaningStatus {
  if (remaining == null) return "Not Applicable";
  if (remaining < 0) return "Overdue";
  if (remaining === 0) return "Due";
  if (remaining <= warningThreshold) return "Due Soon";
  return "Current";
}

export function healthLabelFromScore(
  score: number,
): "Excellent" | "Healthy" | "Attention Needed" | "High Risk" | "Critical" {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Healthy";
  if (score >= 55) return "Attention Needed";
  if (score >= 35) return "High Risk";
  return "Critical";
}
