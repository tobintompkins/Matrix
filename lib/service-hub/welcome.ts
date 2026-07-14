/**
 * Patch 47 — role-aware Service Hub welcome copy.
 * Displays human-readable messages only (never raw role IDs).
 */

import type { MatrixRole } from "@/lib/auth/types";

export const SERVICE_HUB_SUBTITLE =
  "Monitor service operations, preventive maintenance, customer equipment, parts, and technician activity from one workspace.";

export function serviceHubWelcomeMessage(
  role: MatrixRole | null | undefined,
): string {
  switch (role) {
    case "FIELD_TECHNICIAN":
      return "Welcome back. Review your assigned service calls, upcoming PM work, and customer equipment.";
    case "SERVICE_MANAGER":
      return "Welcome back. Monitor service activity, technician workload, PM compliance, and operational risks.";
    case "ADMIN":
    case "SUPER_ADMIN":
      return "Welcome back. Review organization-wide service performance, maintenance activity, inventory, and system alerts.";
    case "WAREHOUSE_MANAGER":
      return "Welcome back. Review inventory health, purchase requests, and parts needed for field service.";
    case "TRAINER":
      return "Welcome back. Here is the latest activity across Matrix.";
    case "CUSTOMER_ADMIN":
    case "CUSTOMER_MANAGER":
    case "CUSTOMER_USER":
    case "CUSTOMER_VIEWER":
      return "Welcome back. Here is the latest activity across Matrix.";
    default:
      return "Welcome back. Here is the latest activity across Matrix.";
  }
}

export function isTechnicianRole(role: MatrixRole | null | undefined): boolean {
  return role === "FIELD_TECHNICIAN";
}

export function isManagerOrAdminRole(
  role: MatrixRole | null | undefined,
): boolean {
  return (
    role === "SERVICE_MANAGER" ||
    role === "ADMIN" ||
    role === "SUPER_ADMIN" ||
    role === "WAREHOUSE_MANAGER"
  );
}
