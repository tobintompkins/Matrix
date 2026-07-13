/**
 * In-app notification store (Patch 36).
 * sessionStorage prototype — Prisma Notification model is the future target.
 */

import {
  listAllMaintenanceCompletions,
  listCopyCountHistory,
  listMaintenanceProfiles,
  recordMaintenanceAudit,
} from "@/lib/maintenance/repository";
import {
  countUnread,
  filterNotifications,
  sortNotificationsNewestFirst,
} from "./helpers";
import {
  buildDashboardAlertWidgets,
  buildTechnicianTaskList,
  groupVisitsByCustomerSite,
} from "./planning";
import { buildMaintenancePredictions } from "./predictions";
import {
  createEventNotification,
  generateMaintenanceReminders,
} from "./reminders";
import {
  computePrinterHealthIndicators,
  buildMaintenanceRecommendations,
} from "./health";
import type {
  MatrixNotification,
  NotificationFilterState,
  NotificationPreferences,
  ReminderThresholdConfig,
  TechnicianTask,
} from "./types";
import {
  DEFAULT_REMINDER_THRESHOLDS,
  defaultNotificationPreferences,
} from "./types";

const NOTIFICATIONS_KEY = "matrix.notifications.v1";
const THRESHOLDS_KEY = "matrix.notification.thresholds.v1";
const PREFS_KEY = "matrix.notification.prefs.v1";
const TASKS_KEY = "matrix.notification.tasks.v1";
const GENERATED_DAY_KEY = "matrix.notifications.generated-day.v1";

let notificationsStore: MatrixNotification[] | null = null;
let thresholdsStore: ReminderThresholdConfig | null = null;
let prefsStore: NotificationPreferences[] | null = null;
let tasksStore: TechnicianTask[] | null = null;

function clone<T>(value: T): T {
  return structuredClone(value);
}

function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota
  }
}

function ensureNotifications(): MatrixNotification[] {
  if (notificationsStore) return notificationsStore;
  notificationsStore =
    readJson<MatrixNotification[]>(NOTIFICATIONS_KEY) ?? [];
  return notificationsStore;
}

function commitNotifications(next: MatrixNotification[]): void {
  notificationsStore = next;
  writeJson(NOTIFICATIONS_KEY, next);
}

function ensureThresholds(): ReminderThresholdConfig {
  if (thresholdsStore) return thresholdsStore;
  thresholdsStore =
    readJson<ReminderThresholdConfig>(THRESHOLDS_KEY) ??
    clone(DEFAULT_REMINDER_THRESHOLDS);
  return thresholdsStore;
}

function commitThresholds(next: ReminderThresholdConfig): void {
  thresholdsStore = next;
  writeJson(THRESHOLDS_KEY, next);
}

function ensurePrefs(): NotificationPreferences[] {
  if (prefsStore) return prefsStore;
  prefsStore = readJson<NotificationPreferences[]>(PREFS_KEY) ?? [];
  return prefsStore;
}

function commitPrefs(next: NotificationPreferences[]): void {
  prefsStore = next;
  writeJson(PREFS_KEY, next);
}

function ensureTasks(): TechnicianTask[] {
  if (tasksStore) return tasksStore;
  tasksStore = readJson<TechnicianTask[]>(TASKS_KEY) ?? [];
  return tasksStore;
}

function commitTasks(next: TechnicianTask[]): void {
  tasksStore = next;
  writeJson(TASKS_KEY, next);
}

function mergeNotifications(
  existing: MatrixNotification[],
  incoming: MatrixNotification[],
): MatrixNotification[] {
  const map = new Map(existing.map((n) => [n.id, n]));
  for (const n of incoming) {
    const prev = map.get(n.id);
    if (prev) {
      map.set(n.id, { ...n, readAt: prev.readAt });
    } else {
      map.set(n.id, n);
    }
  }
  return sortNotificationsNewestFirst([...map.values()]);
}

/** Efficient daily reminder generation — runs at most once per calendar day. */
export function ensureDailyReminders(now: Date = new Date()): {
  generated: number;
  notifications: MatrixNotification[];
} {
  const day = now.toISOString().slice(0, 10);
  if (typeof window !== "undefined") {
    const last = window.sessionStorage.getItem(GENERATED_DAY_KEY);
    if (last === day && ensureNotifications().length > 0) {
      return {
        generated: 0,
        notifications: clone(ensureNotifications()),
      };
    }
  }

  const profiles = listMaintenanceProfiles();
  const thresholds = ensureThresholds();
  const generated = generateMaintenanceReminders(
    profiles,
    thresholds,
    now,
  );
  const merged = mergeNotifications(ensureNotifications(), generated);
  commitNotifications(merged);

  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(GENERATED_DAY_KEY, day);
  }

  if (generated.length > 0) {
    recordMaintenanceAudit({
      action: "REMINDER_GENERATED",
      actor: "Matrix Reminder Engine",
      details: `Generated ${generated.length} maintenance reminders for ${day}`,
      newValue: String(generated.length),
    });
  }

  return { generated: generated.length, notifications: clone(merged) };
}

export function listNotifications(
  filters?: NotificationFilterState,
): MatrixNotification[] {
  ensureDailyReminders();
  const all = sortNotificationsNewestFirst(ensureNotifications());
  return filters ? filterNotifications(all, filters) : clone(all);
}

export function getUnreadNotificationCount(): number {
  ensureDailyReminders();
  return countUnread(ensureNotifications());
}

export function markNotificationRead(
  id: string,
  actor = "Matrix User",
): MatrixNotification | undefined {
  const list = ensureNotifications();
  const idx = list.findIndex((n) => n.id === id);
  if (idx < 0) return undefined;
  if (list[idx].readAt) return clone(list[idx]);
  const next = [...list];
  next[idx] = { ...next[idx], readAt: new Date().toISOString() };
  commitNotifications(next);
  recordMaintenanceAudit({
    action: "NOTIFICATION_READ",
    actor,
    printerId: next[idx].printerId,
    details: `Read notification ${id}`,
    newValue: id,
  });
  return clone(next[idx]);
}

export function markAllNotificationsRead(actor = "Matrix User"): number {
  const list = ensureNotifications();
  let count = 0;
  const next = list.map((n) => {
    if (n.readAt) return n;
    count += 1;
    return { ...n, readAt: new Date().toISOString() };
  });
  commitNotifications(next);
  if (count > 0) {
    recordMaintenanceAudit({
      action: "NOTIFICATION_READ",
      actor,
      details: `Marked ${count} notifications as read`,
      newValue: String(count),
    });
  }
  return count;
}

export function pushNotification(
  notification: MatrixNotification,
): MatrixNotification {
  const prefs = getNotificationPreferences(notification.userIds[0] ?? "default");
  if (!prefs.inAppEnabled) {
    return notification;
  }
  const merged = mergeNotifications(ensureNotifications(), [notification]);
  commitNotifications(merged);
  recordMaintenanceAudit({
    action: "NOTIFICATION_CREATED",
    actor: "Matrix Notification Engine",
    printerId: notification.printerId,
    details: notification.title,
    newValue: notification.id,
  });
  return clone(notification);
}

export function notifyMaintenanceCompleted(input: {
  printerId: string;
  printerName: string;
  customerName: string;
  kind: string;
  technician: string;
}): MatrixNotification {
  return pushNotification(
    createEventNotification({
      type: "MAINTENANCE_COMPLETED",
      title: `${input.kind} completed — ${input.printerName}`,
      message: `${input.technician} completed ${input.kind} on ${input.printerName}.`,
      printerId: input.printerId,
      printerName: input.printerName,
      customerName: input.customerName,
      priority: "NORMAL",
      relatedRecordType: "maintenance_completion",
      relatedRecordId: input.printerId,
    }),
  );
}

export function notifyCopyCountUpdated(input: {
  printerId: string;
  printerName: string;
  customerName: string;
  copyCount: number;
  enteredBy: string;
}): MatrixNotification {
  return pushNotification(
    createEventNotification({
      type: "COPY_COUNT_UPDATED",
      title: `Copy count updated — ${input.printerName}`,
      message: `${input.enteredBy} recorded ${input.copyCount.toLocaleString("en-US")} copies.`,
      printerId: input.printerId,
      printerName: input.printerName,
      customerName: input.customerName,
      priority: "LOW",
      relatedRecordType: "copy_count",
      relatedRecordId: input.printerId,
    }),
  );
}

export function notifyScheduleChanged(input: {
  printerId: string;
  printerName: string;
  customerName: string;
  details: string;
}): MatrixNotification {
  return pushNotification(
    createEventNotification({
      type: "SCHEDULE_CHANGED",
      title: `Schedule changed — ${input.printerName}`,
      message: input.details,
      printerId: input.printerId,
      printerName: input.printerName,
      customerName: input.customerName,
      priority: "NORMAL",
      relatedRecordType: "schedule",
      relatedRecordId: input.printerId,
    }),
  );
}

/** Patch 41 — service ticket / dispatch notifications (in-app; email/SMS later). */
export function notifyTicketEvent(input: {
  type: import("./types").NotificationType;
  title: string;
  message: string;
  ticketId: string;
  ticketNumber: string;
  printerId?: string | null;
  printerName?: string | null;
  customerName?: string | null;
  priority?: import("./types").NotificationPriority;
  userIds?: string[];
}): MatrixNotification {
  return pushNotification(
    createEventNotification({
      type: input.type,
      title: input.title,
      message: input.message,
      printerId: input.printerId ?? null,
      printerName: input.printerName ?? null,
      customerName: input.customerName ?? null,
      priority: input.priority ?? "NORMAL",
      relatedRecordType: "service_ticket",
      relatedRecordId: input.ticketId,
      userIds: input.userIds,
    }),
  );
}

/** Patch 43 — warehouse / inventory event notifications. */
export function notifyInventoryEvent(input: {
  type: import("./types").NotificationType;
  title: string;
  message: string;
  warehouseId?: string | null;
  partNumber?: string | null;
  referenceId?: string | null;
  priority?: import("./types").NotificationPriority;
  userIds?: string[];
}): MatrixNotification {
  return pushNotification(
    createEventNotification({
      type: input.type,
      title: input.title,
      message: input.message,
      printerId: null,
      printerName: input.partNumber ?? null,
      customerName: null,
      priority: input.priority ?? "NORMAL",
      relatedRecordType: "inventory",
      relatedRecordId: input.referenceId ?? input.warehouseId ?? null,
      userIds: input.userIds,
    }),
  );
}

export function getReminderThresholds(): ReminderThresholdConfig {
  return clone(ensureThresholds());
}

export function updateReminderThresholds(
  patch: Partial<Omit<ReminderThresholdConfig, "id">>,
  updatedBy: string,
): ReminderThresholdConfig {
  const previous = ensureThresholds();
  const next: ReminderThresholdConfig = {
    ...previous,
    ...patch,
    id: previous.id,
    updatedAt: new Date().toISOString(),
    updatedBy,
  };
  commitThresholds(next);
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(GENERATED_DAY_KEY);
  }
  recordMaintenanceAudit({
    action: "REMINDER_THRESHOLDS_UPDATED",
    actor: updatedBy,
    details: "Reminder thresholds updated",
    previousValue: JSON.stringify(previous),
    newValue: JSON.stringify(next),
  });
  return clone(next);
}

export function getNotificationPreferences(
  userId: string,
): NotificationPreferences {
  const found = ensurePrefs().find((p) => p.userId === userId);
  return clone(found ?? defaultNotificationPreferences(userId));
}

export function saveNotificationPreferences(
  prefs: NotificationPreferences,
): NotificationPreferences {
  const list = ensurePrefs();
  const idx = list.findIndex((p) => p.userId === prefs.userId);
  const nextPrefs = { ...prefs, updatedAt: new Date().toISOString() };
  const next = [...list];
  if (idx >= 0) next[idx] = nextPrefs;
  else next.push(nextPrefs);
  commitPrefs(next);
  recordMaintenanceAudit({
    action: "NOTIFICATION_PREFERENCES_UPDATED",
    actor: prefs.userId,
    details: "Notification preferences saved",
    newValue: JSON.stringify(nextPrefs),
  });
  return clone(nextPrefs);
}

export function listTechnicianTasks(): TechnicianTask[] {
  const profiles = listMaintenanceProfiles();
  const tasks = buildTechnicianTaskList(profiles, ensureTasks());
  commitTasks(tasks);
  return clone(tasks);
}

export function updateTechnicianTask(
  id: string,
  patch: Partial<
    Pick<TechnicianTask, "status" | "notes" | "scheduledDate">
  >,
  actor = "Matrix User",
): TechnicianTask | undefined {
  const tasks = listTechnicianTasks();
  const idx = tasks.findIndex((t) => t.id === id);
  if (idx < 0) return undefined;
  const next = [...tasks];
  next[idx] = { ...next[idx], ...patch };
  commitTasks(next);
  recordMaintenanceAudit({
    action: "TECHNICIAN_TASK_UPDATED",
    actor,
    printerId: next[idx].printerId,
    details: `Task ${id} → ${patch.status ?? next[idx].status}`,
    newValue: JSON.stringify(patch),
  });
  return clone(next[idx]);
}

export function listGroupedVisitRecommendations() {
  return groupVisitsByCustomerSite(listTechnicianTasks());
}

export function listDashboardAlertWidgets() {
  return buildDashboardAlertWidgets(
    listMaintenanceProfiles(),
    listAllMaintenanceCompletions(),
  );
}

export function getPrinterPredictions(printerId: string) {
  const profile = listMaintenanceProfiles().find(
    (p) => p.printerId.toUpperCase() === printerId.toUpperCase(),
  );
  if (!profile) return [];
  const history = listCopyCountHistory(printerId);
  return buildMaintenancePredictions(profile, history);
}

export function recalculatePrinterPredictions(printerId: string) {
  const predictions = getPrinterPredictions(printerId);
  recordMaintenanceAudit({
    action: "PREDICTION_RECALCULATED",
    actor: "Matrix Prediction Engine",
    printerId,
    details: `Recalculated predictions for ${printerId}`,
  });
  return predictions;
}

export function getPrinterHealth(printerId: string) {
  const profile = listMaintenanceProfiles().find(
    (p) => p.printerId.toUpperCase() === printerId.toUpperCase(),
  );
  if (!profile) return null;
  const completions = listAllMaintenanceCompletions().filter(
    (c) => c.printerId === profile.printerId,
  );
  return computePrinterHealthIndicators(profile, completions);
}

export function getPrinterRecommendations(printerId: string) {
  const profile = listMaintenanceProfiles().find(
    (p) => p.printerId.toUpperCase() === printerId.toUpperCase(),
  );
  if (!profile) return [];
  return buildMaintenanceRecommendations(profile);
}
