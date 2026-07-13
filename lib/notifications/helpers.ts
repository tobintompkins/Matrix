/**
 * Notification filtering & query helpers (Patch 36).
 */

import type {
  MatrixNotification,
  NotificationFilterState,
} from "./types";

export function filterNotifications(
  notifications: MatrixNotification[],
  filters: NotificationFilterState,
): MatrixNotification[] {
  return notifications.filter((n) => {
    if (filters.unreadOnly && n.readAt) return false;
    if (filters.priority !== "ALL" && n.priority !== filters.priority) {
      return false;
    }
    if (
      filters.maintenanceType !== "ALL" &&
      n.type !== filters.maintenanceType
    ) {
      return false;
    }
    if (
      filters.customer &&
      (n.customerName ?? "") !== filters.customer
    ) {
      return false;
    }
    const day = n.createdAt.slice(0, 10);
    if (filters.dateFrom && day < filters.dateFrom) return false;
    if (filters.dateTo && day > filters.dateTo) return false;
    return true;
  });
}

export function countUnread(notifications: MatrixNotification[]): number {
  return notifications.filter((n) => !n.readAt).length;
}

export function sortNotificationsNewestFirst(
  notifications: MatrixNotification[],
): MatrixNotification[] {
  return [...notifications].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}
