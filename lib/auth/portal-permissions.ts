import { hasMatrixPermission } from "./permissions";
import type { MatrixPermission, MatrixRole } from "./types";

export function canAccessPortal(role: MatrixRole): boolean {
  return (
    hasMatrixPermission(role, "VIEW_CUSTOMER_PORTAL") ||
    hasMatrixPermission(role, "VIEW_CUSTOMER_PORTAL_TICKETS") ||
    role === "CUSTOMER_VIEWER" ||
    role === "CUSTOMER_ADMIN" ||
    role === "CUSTOMER_MANAGER" ||
    role === "CUSTOMER_USER"
  );
}

export function canManagePortalUsers(role: MatrixRole): boolean {
  return hasMatrixPermission(role, "MANAGE_PORTAL_USERS");
}

export function canAdministerPortal(role: MatrixRole): boolean {
  return (
    hasMatrixPermission(role, "ADMINISTER_CUSTOMER_PORTAL") ||
    hasMatrixPermission(role, "MANAGE_USERS")
  );
}

export const PORTAL_PERMISSIONS: MatrixPermission[] = [
  "VIEW_CUSTOMER_PORTAL",
  "MANAGE_PORTAL_USERS",
  "ADMINISTER_CUSTOMER_PORTAL",
  "APPROVE_PORTAL_SERVICE",
  "VIEW_PORTAL_METERS",
  "VIEW_PORTAL_PM",
  "DOWNLOAD_PORTAL_REPORTS",
];
