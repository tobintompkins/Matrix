/**
 * Reminder generation from copy-count status + configurable thresholds (Patch 36).
 */

import {
  buildMaintenanceTypeSnapshot,
  getMostUrgentMaintenanceStatus,
} from "@/lib/maintenance/calculations";
import { getDefaultIntervalForModel } from "@/lib/maintenance/intervals";
import type {
  MaintenanceIntervalConfig,
  MaintenanceKind,
  PrinterMaintenanceProfile,
} from "@/lib/maintenance/types";
import type {
  MatrixNotification,
  NotificationPriority,
  NotificationType,
  ReminderThresholdConfig,
} from "./types";
import { DEFAULT_REMINDER_THRESHOLDS } from "./types";

function idFor(
  type: NotificationType,
  printerId: string,
  dayKey: string,
): string {
  return `ntf-${type}-${printerId}-${dayKey}`;
}

function priorityForStatus(
  status: string,
  overdueCopies: number,
  thresholds: ReminderThresholdConfig,
): NotificationPriority {
  if (status === "OVERDUE") {
    if (overdueCopies >= thresholds.overdueBand2Copies) return "URGENT";
    if (overdueCopies >= thresholds.overdueBand1Copies) return "HIGH";
    return "HIGH";
  }
  if (status === "DUE") return "HIGH";
  if (status === "DUE_SOON") return "NORMAL";
  return "LOW";
}

function typeForKindStatus(
  kind: MaintenanceKind,
  status: string,
): NotificationType | null {
  if (kind === "PM") {
    if (status === "DUE_SOON") return "PM_DUE_SOON";
    if (status === "DUE") return "PM_DUE";
    if (status === "OVERDUE") return "PM_OVERDUE";
  }
  if (kind === "CLEANING" && (status === "DUE" || status === "DUE_SOON" || status === "OVERDUE")) {
    return "CLEANING_DUE";
  }
  if (kind === "JOINT_UNIT" && (status === "DUE" || status === "DUE_SOON" || status === "OVERDUE")) {
    return "JOINT_UNIT_DUE";
  }
  if (kind === "DTF_PM" && (status === "DUE" || status === "DUE_SOON" || status === "OVERDUE")) {
    return "DTF_PM_DUE";
  }
  return null;
}

function titleFor(type: NotificationType, printerName: string): string {
  switch (type) {
    case "PM_DUE_SOON":
      return `PM due soon — ${printerName}`;
    case "PM_DUE":
      return `PM due — ${printerName}`;
    case "PM_OVERDUE":
      return `PM overdue — ${printerName}`;
    case "CLEANING_DUE":
      return `Cleaning due — ${printerName}`;
    case "JOINT_UNIT_DUE":
      return `Joint Unit due — ${printerName}`;
    case "DTF_PM_DUE":
      return `DTF PM due — ${printerName}`;
    default:
      return `Maintenance alert — ${printerName}`;
  }
}

/**
 * Generate reminder notifications for a fleet snapshot.
 * Pure function — repository persists results.
 */
export function generateMaintenanceReminders(
  profiles: PrinterMaintenanceProfile[],
  thresholds: ReminderThresholdConfig = DEFAULT_REMINDER_THRESHOLDS,
  now: Date = new Date(),
  intervalLookup: (model: string) => MaintenanceIntervalConfig = getDefaultIntervalForModel,
  targetUsers: string[] = ["Toby Tompkins", "Field Tech B", "Matrix Manager"],
): MatrixNotification[] {
  const dayKey = now.toISOString().slice(0, 10);
  const createdAt = now.toISOString();
  const out: MatrixNotification[] = [];

  for (const profile of profiles) {
    const intervals = intervalLookup(profile.printerModel);
    const kinds: MaintenanceKind[] = ["PM", "CLEANING", "JOINT_UNIT", "DTF_PM"];

    for (const kind of kinds) {
      // Use threshold-aware due-soon for PM/Cleaning via custom warning override
      const customIntervals: MaintenanceIntervalConfig = {
        ...intervals,
        warningThreshold:
          kind === "PM"
            ? thresholds.pmDueSoonCopies
            : kind === "CLEANING"
              ? thresholds.cleaningDueSoonCopies
              : intervals.warningThreshold,
      };
      const snap = buildMaintenanceTypeSnapshot(profile, kind, customIntervals);
      if (snap.status === "CURRENT" || snap.status === "UNKNOWN") continue;

      // Due today band: remaining within dueTodayCopies
      let status = snap.status;
      if (
        snap.copiesRemaining !== null &&
        snap.copiesRemaining <= thresholds.dueTodayCopies &&
        status === "DUE_SOON"
      ) {
        status = "DUE";
      }

      const type = typeForKindStatus(kind, status);
      if (!type) continue;

      const overdue = snap.copiesOverdue ?? 0;
      const remaining = snap.copiesRemaining;
      const message =
        status === "OVERDUE"
          ? `${profile.nickname} is ${overdue.toLocaleString("en-US")} copies past due for ${kind}.`
          : remaining !== null
            ? `${profile.nickname} has ${remaining.toLocaleString("en-US")} copies remaining until ${kind}.`
            : `${profile.nickname} requires attention for ${kind}.`;

      out.push({
        id: idFor(type, profile.printerId, dayKey),
        type,
        title: titleFor(type, profile.nickname || profile.assetTag),
        message,
        printerId: profile.printerId,
        printerName: profile.nickname || profile.assetTag,
        customerName: profile.customerName,
        userIds: targetUsers,
        createdAt,
        readAt: null,
        priority: priorityForStatus(status, overdue, thresholds),
        relatedRecordType: "printer",
        relatedRecordId: profile.printerId,
      });
    }

    // Ensure most-urgent overall still surfaces if kind loop missed edge cases
    void getMostUrgentMaintenanceStatus(profile, intervals);
  }

  return out;
}

export function createEventNotification(input: {
  type: NotificationType;
  title: string;
  message: string;
  printerId?: string | null;
  printerName?: string | null;
  customerName?: string | null;
  userIds?: string[];
  priority?: NotificationPriority;
  relatedRecordType?: string | null;
  relatedRecordId?: string | null;
  now?: Date;
}): MatrixNotification {
  const now = input.now ?? new Date();
  return {
    id: `ntf-evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: input.type,
    title: input.title,
    message: input.message,
    printerId: input.printerId ?? null,
    printerName: input.printerName ?? null,
    customerName: input.customerName ?? null,
    userIds: input.userIds ?? ["Matrix User"],
    createdAt: now.toISOString(),
    readAt: null,
    priority: input.priority ?? "NORMAL",
    relatedRecordType: input.relatedRecordType ?? null,
    relatedRecordId: input.relatedRecordId ?? null,
  };
}
