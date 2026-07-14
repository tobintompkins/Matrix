/**
 * Patch 49C — Service Hub widget visibility by role (existing widgets only).
 */

import type { MatrixRole } from "@/lib/auth/types";

export type ServiceHubWidgetId =
  | "open_service_calls"
  | "pm_due_soon"
  | "overdue_pm"
  | "low_stock_parts"
  | "my_work"
  | "recent_activity"
  | "attention_required"
  | "operations_overview";

export const SERVICE_HUB_WIDGETS: Array<{
  id: ServiceHubWidgetId;
  label: string;
}> = [
  { id: "open_service_calls", label: "Open Service Calls" },
  { id: "pm_due_soon", label: "PM Due Soon" },
  { id: "overdue_pm", label: "Overdue PM" },
  { id: "low_stock_parts", label: "Low-Stock Parts" },
  { id: "my_work", label: "My Work" },
  { id: "recent_activity", label: "Recent Activity" },
  { id: "attention_required", label: "Attention Required" },
  { id: "operations_overview", label: "Operations Overview" },
];

const DEFAULT_ENABLED: ServiceHubWidgetId[] = SERVICE_HUB_WIDGETS.map((w) => w.id);

const STORAGE_KEY = "matrix.admin.dashboard-config.v1";

type Store = Record<string, ServiceHubWidgetId[]>;

function read(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Store;
  } catch {
    return {};
  }
}

function write(next: Store) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function getDashboardWidgetsForRole(
  role: MatrixRole,
): ServiceHubWidgetId[] {
  return read()[role] ?? [...DEFAULT_ENABLED];
}

export function updateDashboardConfiguration(
  role: MatrixRole,
  widgets: ServiceHubWidgetId[],
): { ok: true } | { ok: false; error: string } {
  const allowed = new Set(SERVICE_HUB_WIDGETS.map((w) => w.id));
  if (widgets.some((w) => !allowed.has(w))) {
    return { ok: false, error: "Only existing Service Hub widgets can be configured." };
  }
  write({ ...read(), [role]: widgets });
  return { ok: true };
}

export function restoreDashboardDefaults(role: MatrixRole): void {
  const next = { ...read() };
  delete next[role];
  write(next);
}

export function isMaintenanceModeEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem("matrix.admin.maintenance-mode") === "1";
  } catch {
    return false;
  }
}

export function setMaintenanceMode(
  enabled: boolean,
  reason: string,
): { ok: true } | { ok: false; error: string } {
  if (enabled && reason.trim().length < 3) {
    return { ok: false, error: "A reason is required to enable maintenance mode." };
  }
  if (typeof window === "undefined") {
    return { ok: false, error: "Maintenance mode can only be toggled in the browser session." };
  }
  try {
    if (enabled) {
      window.sessionStorage.setItem("matrix.admin.maintenance-mode", "1");
      window.sessionStorage.setItem(
        "matrix.admin.maintenance-reason",
        reason.trim(),
      );
    } else {
      window.sessionStorage.removeItem("matrix.admin.maintenance-mode");
      window.sessionStorage.removeItem("matrix.admin.maintenance-reason");
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Unable to update maintenance mode." };
  }
}
