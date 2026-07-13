/**
 * Technician tasks, visit grouping, and dashboard alert widgets (Patch 36).
 */

import { digitalTwinFleet } from "@/lib/digital-twin/data";
import {
  buildAllMaintenanceSnapshots,
  getMostUrgentMaintenanceStatus,
} from "@/lib/maintenance/calculations";
import { getDefaultIntervalForModel } from "@/lib/maintenance/intervals";
import { getMaintenanceStatusLabel } from "@/lib/maintenance/helpers";
import type {
  MaintenanceCompletionRecord,
  MaintenanceIntervalConfig,
  PrinterMaintenanceProfile,
} from "@/lib/maintenance/types";
import type {
  DashboardAlertWidget,
  GroupedVisitRecommendation,
  NotificationPriority,
  TechnicianTask,
} from "./types";

function twinFor(printerId: string) {
  const upper = printerId.trim().toUpperCase();
  return digitalTwinFleet.find(
    (m) => m.identity.machineId.toUpperCase() === upper,
  );
}

function durationFor(
  kind: TechnicianTask["taskType"],
): number {
  switch (kind) {
    case "PM":
      return 3;
    case "JOINT_UNIT":
      return 4;
    case "DTF_PM":
      return 3;
    case "CLEANING":
      return 1.5;
    default:
      return 1;
  }
}

function priorityFromStatus(status: string): NotificationPriority {
  if (status === "OVERDUE") return "URGENT";
  if (status === "DUE") return "HIGH";
  if (status === "DUE_SOON") return "NORMAL";
  return "LOW";
}

export function buildTechnicianTaskList(
  profiles: PrinterMaintenanceProfile[],
  existing: TechnicianTask[] = [],
  intervalLookup: (model: string) => MaintenanceIntervalConfig = getDefaultIntervalForModel,
): TechnicianTask[] {
  const byId = new Map(existing.map((t) => [t.id, t]));
  const tasks: TechnicianTask[] = [];

  for (const profile of profiles) {
    const twin = twinFor(profile.printerId);
    const intervals = intervalLookup(profile.printerModel);
    const snaps = buildAllMaintenanceSnapshots(profile, intervals);
    const urgent = getMostUrgentMaintenanceStatus(profile, intervals);

    if (urgent === "UNKNOWN") {
      const id = `task-setup-${profile.printerId}`;
      const prev = byId.get(id);
      tasks.push({
        id,
        printerId: profile.printerId,
        printerName: profile.nickname || profile.assetTag,
        customerName: profile.customerName,
        siteName: profile.siteName,
        address: twin?.location.shipToAddress ?? "Address unavailable",
        taskType: "SETUP",
        priority: "NORMAL",
        estimatedDurationHours: 0.5,
        dueStatus: "Setup Required",
        status: prev?.status ?? "OPEN",
        notes: prev?.notes ?? "",
        scheduledDate: prev?.scheduledDate ?? null,
      });
      continue;
    }

    for (const snap of snaps) {
      if (snap.status === "CURRENT" || snap.status === "UNKNOWN") continue;
      const id = `task-${snap.kind}-${profile.printerId}`;
      const prev = byId.get(id);
      if (prev?.status === "COMPLETED") {
        tasks.push(prev);
        continue;
      }
      tasks.push({
        id,
        printerId: profile.printerId,
        printerName: profile.nickname || profile.assetTag,
        customerName: profile.customerName,
        siteName: profile.siteName,
        address: twin?.location.shipToAddress ?? "Address unavailable",
        taskType: snap.kind,
        priority: priorityFromStatus(snap.status),
        estimatedDurationHours: durationFor(snap.kind),
        dueStatus: getMaintenanceStatusLabel(snap.status),
        status: prev?.status ?? "OPEN",
        notes: prev?.notes ?? "",
        scheduledDate: prev?.scheduledDate ?? null,
      });
    }
  }

  const rank: Record<NotificationPriority, number> = {
    URGENT: 0,
    HIGH: 1,
    NORMAL: 2,
    LOW: 3,
  };
  return tasks.sort(
    (a, b) =>
      rank[a.priority] - rank[b.priority] ||
      a.customerName.localeCompare(b.customerName),
  );
}

export function groupVisitsByCustomerSite(
  tasks: TechnicianTask[],
): GroupedVisitRecommendation[] {
  const open = tasks.filter(
    (t) => t.status === "OPEN" || t.status === "IN_PROGRESS",
  );
  const groups = new Map<string, TechnicianTask[]>();
  for (const task of open) {
    const key = `${task.customerName}||${task.siteName}`;
    const list = groups.get(key) ?? [];
    list.push(task);
    groups.set(key, list);
  }

  const recommendations: GroupedVisitRecommendation[] = [];
  for (const [, list] of groups) {
    if (list.length < 2) continue;
    const printers = [...new Set(list.map((t) => t.printerId))];
    if (printers.length < 2 && list.length < 2) continue;

    const duration = list.reduce((s, t) => s + t.estimatedDurationHours, 0);
    const separateVisits = list.length;
    const priority = list.some((t) => t.priority === "URGENT")
      ? "URGENT"
      : list.some((t) => t.priority === "HIGH")
        ? "HIGH"
        : "NORMAL";

    recommendations.push({
      id: `visit-${list[0].customerName}-${list[0].siteName}`.replace(
        /\s+/g,
        "-",
      ),
      customerName: list[0].customerName,
      siteName: list[0].siteName,
      address: list[0].address,
      printerIds: printers,
      printerNames: [...new Set(list.map((t) => t.printerName))],
      taskTypes: [...new Set(list.map((t) => t.taskType))],
      estimatedDurationHours: Math.round(duration * 10) / 10,
      savingsNote: `Combine ${separateVisits} tasks across ${printers.length} printer(s) into one site visit (~${separateVisits - 1} fewer trips).`,
      priority,
    });
  }

  return recommendations.sort(
    (a, b) => b.printerIds.length - a.printerIds.length,
  );
}

function startOfWeek(d: Date): Date {
  const next = new Date(d);
  next.setDate(next.getDate() - next.getDay());
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
}

export function buildDashboardAlertWidgets(
  profiles: PrinterMaintenanceProfile[],
  completions: MaintenanceCompletionRecord[],
  now: Date = new Date(),
  intervalLookup: (model: string) => MaintenanceIntervalConfig = getDefaultIntervalForModel,
): DashboardAlertWidget[] {
  const overdue: DashboardAlertWidget["items"] = [];
  const thisWeek: DashboardAlertWidget["items"] = [];
  const nextWeek: DashboardAlertWidget["items"] = [];

  const weekStart = startOfWeek(now);
  const weekEnd = addDays(weekStart, 6);
  const nextWeekStart = addDays(weekStart, 7);
  const nextWeekEnd = addDays(nextWeekStart, 6);

  for (const profile of profiles) {
    const intervals = intervalLookup(profile.printerModel);
    const snaps = buildAllMaintenanceSnapshots(profile, intervals);
    const urgent = getMostUrgentMaintenanceStatus(profile, intervals);
    const name = profile.nickname || profile.assetTag;

    if (urgent === "OVERDUE") {
      overdue.push({
        id: profile.printerId,
        label: name,
        detail: `${profile.customerName} · ${getMaintenanceStatusLabel(urgent)}`,
      });
    }

    for (const snap of snaps) {
      if (snap.status === "CURRENT" || snap.status === "UNKNOWN") continue;
      if (
        snap.nextDueCount === null ||
        profile.currentCopyCount === null ||
        !profile.monthlyVolume
      ) {
        if (snap.status === "DUE" || snap.status === "DUE_SOON") {
          thisWeek.push({
            id: `${profile.printerId}-${snap.kind}`,
            label: `${name} · ${snap.label}`,
            detail: getMaintenanceStatusLabel(snap.status),
          });
        }
        continue;
      }
      const remaining = snap.nextDueCount - profile.currentCopyCount;
      const days = Math.round((remaining / profile.monthlyVolume) * 30);
      const dueDate = addDays(now, Math.max(0, days));
      const item = {
        id: `${profile.printerId}-${snap.kind}`,
        label: `${name} · ${snap.label}`,
        detail: dueDate.toISOString().slice(0, 10),
      };
      if (dueDate >= weekStart && dueDate <= weekEnd) thisWeek.push(item);
      else if (dueDate >= nextWeekStart && dueDate <= nextWeekEnd) {
        nextWeek.push(item);
      }
    }
  }

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const newlyCompleted = completions
    .filter((c) => new Date(c.completedAt).getTime() >= monthStart)
    .slice(0, 8)
    .map((c) => ({
      id: c.id,
      label: `${c.kind} · ${c.printerId}`,
      detail: `${c.technician} · ${c.completedAt.slice(0, 10)}`,
    }));

  const withVolume = profiles
    .filter((p) => p.monthlyVolume != null)
    .sort((a, b) => (b.monthlyVolume ?? 0) - (a.monthlyVolume ?? 0));
  const highVolume = withVolume.slice(0, 5).map((p) => ({
    id: p.printerId,
    label: p.nickname || p.assetTag,
    detail: `${(p.monthlyVolume ?? 0).toLocaleString("en-US")} / mo`,
  }));
  const lowActivity = [...withVolume]
    .reverse()
    .slice(0, 5)
    .map((p) => ({
      id: p.printerId,
      label: p.nickname || p.assetTag,
      detail: `${(p.monthlyVolume ?? 0).toLocaleString("en-US")} / mo`,
    }));

  return [
    {
      id: "overdue",
      title: "Overdue Maintenance",
      count: overdue.length,
      description: "Printers past due for PM or related service",
      accent: "text-rose-400",
      items: overdue,
    },
    {
      id: "this-week",
      title: "Due This Week",
      count: thisWeek.length,
      description: "Estimated due dates falling in the current week",
      accent: "text-amber-300",
      items: thisWeek,
    },
    {
      id: "next-week",
      title: "Due Next Week",
      count: nextWeek.length,
      description: "Estimated due dates in the following week",
      accent: "text-orange-300",
      items: nextWeek,
    },
    {
      id: "completed",
      title: "Newly Completed",
      count: newlyCompleted.length,
      description: "Completions recorded this month",
      accent: "text-emerald-400",
      items: newlyCompleted,
    },
    {
      id: "high-volume",
      title: "High Volume Printers",
      count: highVolume.length,
      description: "Highest monthly copy volume",
      accent: "text-cyan-400",
      items: highVolume,
    },
    {
      id: "low-activity",
      title: "Low Activity Printers",
      count: lowActivity.length,
      description: "Lowest monthly copy volume",
      accent: "text-slate-300",
      items: lowActivity,
    },
  ];
}
