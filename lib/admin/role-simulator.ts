/**
 * Patch 50C-3 — Role Simulator (read-only permission preview).
 * Does not mutate live roles or Clerk metadata.
 */

import {
  getDefaultPermissionsForRole,
  hasMatrixPermission,
} from "@/lib/auth/permissions";
import type { MatrixPermission, MatrixRole } from "@/lib/auth/types";

export const SIMULATABLE_ROLES: MatrixRole[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "SERVICE_MANAGER",
  "REGIONAL_MANAGER",
  "OPERATIONS_MANAGER",
  "DIRECTOR",
  "FIELD_TECHNICIAN",
  "WAREHOUSE_MANAGER",
  "TRAINER",
  "READ_ONLY_AUDITOR",
  "CUSTOMER_ADMIN",
  "CUSTOMER_MANAGER",
  "CUSTOMER_USER",
  "CUSTOMER_VIEWER",
];

/** Key admin surfaces to preview for a simulated role. */
export const ROLE_SIMULATOR_SURFACES: Array<{
  label: string;
  href: string;
  permission: MatrixPermission;
}> = [
  { label: "Administration", href: "/admin", permission: "VIEW_ADMINISTRATION" },
  { label: "Users & Access", href: "/admin/users", permission: "MANAGE_USERS" },
  { label: "Roles & Permissions", href: "/admin/roles", permission: "MANAGE_ROLES" },
  {
    label: "Data Administration",
    href: "/admin/data",
    permission: "VIEW_DATA_ADMINISTRATION",
  },
  {
    label: "System Configuration",
    href: "/admin/configuration",
    permission: "MANAGE_SYSTEM_CONFIGURATION",
  },
  {
    label: "Executive Dashboard",
    href: "/admin/executive",
    permission: "VIEW_EXECUTIVE_ADMIN_DASHBOARD",
  },
  {
    label: "Approval Center",
    href: "/admin/approvals",
    permission: "VIEW_APPROVAL_CENTER",
  },
  {
    label: "Organization Health",
    href: "/admin/organization-health",
    permission: "VIEW_ORGANIZATION_HEALTH",
  },
  {
    label: "Data Quality Center",
    href: "/admin/data-quality",
    permission: "VIEW_DATA_QUALITY_CENTER",
  },
  {
    label: "System Logs",
    href: "/admin/system-logs",
    permission: "VIEW_SYSTEM_LOGS",
  },
  {
    label: "Role Simulator",
    href: "/admin/role-simulator",
    permission: "VIEW_ROLE_SIMULATOR",
  },
  {
    label: "Customer Portal Administration",
    href: "/admin/portal",
    permission: "ADMINISTER_CUSTOMER_PORTAL",
  },
  {
    label: "Archived Records",
    href: "/admin/archived-records",
    permission: "VIEW_ARCHIVED_RECORDS",
  },
  {
    label: "Managed Content",
    href: "/admin/managed-content",
    permission: "MANAGE_ADMIN_CONTENT",
  },
];

export type RoleSimulationResult = {
  role: MatrixRole;
  permissionCount: number;
  permissions: MatrixPermission[];
  surfaces: Array<{
    label: string;
    href: string;
    permission: MatrixPermission;
    allowed: boolean;
  }>;
  isMasterRole: boolean;
  isCustomerRole: boolean;
};

export function simulateRole(role: MatrixRole): RoleSimulationResult {
  const permissions = getDefaultPermissionsForRole(role);
  return {
    role,
    permissionCount: permissions.length,
    permissions,
    surfaces: ROLE_SIMULATOR_SURFACES.map((s) => ({
      ...s,
      allowed: hasMatrixPermission(role, s.permission),
    })),
    isMasterRole: role === "SUPER_ADMIN" || role === "ADMIN",
    isCustomerRole: role.startsWith("CUSTOMER_"),
  };
}
