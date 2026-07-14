/**
 * Patch 49A — Enterprise Administration Center types & role catalog.
 */

import type { MatrixPermission, MatrixRole } from "@/lib/auth/types";

export type AdminUserStatus =
  | "Active"
  | "Inactive"
  | "Invited"
  | "Pending"
  | "Suspended"
  | "Deactivated";

export type AdminAccessScope =
  | "SELF"
  | "ASSIGNED_WORK"
  | "TEAM"
  | "REGION"
  | "ORGANIZATION"
  | "ALL_ORGANIZATIONS";

export type RoleCatalogEntry = {
  role: MatrixRole;
  displayName: string;
  description: string;
  builtIn: boolean;
  category: "field" | "operations" | "leadership" | "administration" | "customer";
};

export const ROLE_CATALOG: RoleCatalogEntry[] = [
  {
    role: "FIELD_TECHNICIAN",
    displayName: "Technician",
    description:
      "Can access assigned service work and permitted customer or machine records.",
    builtIn: true,
    category: "field",
  },
  {
    role: "WAREHOUSE_MANAGER",
    displayName: "Inventory Specialist",
    description:
      "Can manage authorized parts, stock, warehouses, and ordering workflows.",
    builtIn: true,
    category: "operations",
  },
  {
    role: "SERVICE_MANAGER",
    displayName: "Service Manager",
    description:
      "Can oversee permitted technicians, service activity, PM work, and customer operations.",
    builtIn: true,
    category: "operations",
  },
  {
    role: "REGIONAL_MANAGER",
    displayName: "Regional Manager",
    description:
      "Can manage permitted users and operational data within assigned regions.",
    builtIn: true,
    category: "leadership",
  },
  {
    role: "OPERATIONS_MANAGER",
    displayName: "Operations Manager",
    description:
      "Can review and manage broader operational processes where authorized.",
    builtIn: true,
    category: "leadership",
  },
  {
    role: "DIRECTOR",
    displayName: "Director",
    description:
      "Can view broad leadership reporting, access summaries, and organization-level operational information.",
    builtIn: true,
    category: "leadership",
  },
  {
    role: "ADMIN",
    displayName: "Administrator",
    description:
      "Can manage users, access, roles, organization settings, and administrative configuration.",
    builtIn: true,
    category: "administration",
  },
  {
    role: "SUPER_ADMIN",
    displayName: "Super Administrator",
    description:
      "Can manage high-risk security and system controls when explicitly granted.",
    builtIn: true,
    category: "administration",
  },
  {
    role: "READ_ONLY_AUDITOR",
    displayName: "Read-Only Auditor",
    description:
      "Can view authorized records and audit history without changing operational data.",
    builtIn: true,
    category: "administration",
  },
  {
    role: "TRAINER",
    displayName: "Trainer",
    description: "Can view training-relevant fleet and service information.",
    builtIn: true,
    category: "operations",
  },
  {
    role: "CUSTOMER_ADMIN",
    displayName: "Customer Admin",
    description: "Customer portal administrator.",
    builtIn: true,
    category: "customer",
  },
  {
    role: "CUSTOMER_MANAGER",
    displayName: "Customer Manager",
    description: "Customer portal manager.",
    builtIn: true,
    category: "customer",
  },
  {
    role: "CUSTOMER_USER",
    displayName: "Customer User",
    description: "Standard customer portal user.",
    builtIn: true,
    category: "customer",
  },
  {
    role: "CUSTOMER_VIEWER",
    displayName: "Customer Viewer",
    description: "Read-only customer portal access.",
    builtIn: true,
    category: "customer",
  },
];

/** Display concepts not yet separate MatrixRole values — mapped for documentation. */
export const FUTURE_ROLE_ALIASES = [
  {
    displayName: "Senior Technician",
    mapsTo: "FIELD_TECHNICIAN" as MatrixRole,
    note: "Mapped to Technician until a distinct role is introduced.",
  },
  {
    displayName: "Lead Technician",
    mapsTo: "FIELD_TECHNICIAN" as MatrixRole,
    note: "Mapped to Technician until a distinct role is introduced.",
  },
  {
    displayName: "Dispatcher",
    mapsTo: "SERVICE_MANAGER" as MatrixRole,
    note: "Dispatch capabilities remain under service operations permissions.",
  },
];

export const HIGH_RISK_PERMISSIONS: MatrixPermission[] = [
  "MANAGE_USERS",
  "MANAGE_ROLES",
  "MANAGE_PERMISSIONS",
  "MANAGE_SYSTEM_CONFIGURATION",
  "MANAGE_ORGANIZATION_SETTINGS",
  "MANAGE_FEATURE_CONTROLS",
  "VIEW_AUDIT_HISTORY",
  "VIEW_SECURITY_CENTER",
  "DEACTIVATE_USERS",
];

export const ELEVATED_ROLES: MatrixRole[] = [
  "ADMIN",
  "SUPER_ADMIN",
  "DIRECTOR",
  "OPERATIONS_MANAGER",
];

export const ADMIN_ROLES: MatrixRole[] = ["ADMIN", "SUPER_ADMIN"];

export const DEFAULT_ORG_ID = "org-sfx";

export function getRoleDisplayName(role: MatrixRole): string {
  return ROLE_CATALOG.find((r) => r.role === role)?.displayName ?? role;
}

export function getRoleDescription(role: MatrixRole): string {
  return (
    ROLE_CATALOG.find((r) => r.role === role)?.description ??
    "Matrix application role."
  );
}
