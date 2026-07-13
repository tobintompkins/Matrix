import { hasMatrixPermission } from "./permissions";
import type { MatrixPermission, MatrixRole } from "./types";

export function canViewCustomers(role: MatrixRole): boolean {
  return hasMatrixPermission(role, "VIEW_CUSTOMERS");
}

export function canManageCustomers(role: MatrixRole): boolean {
  return hasMatrixPermission(role, "MANAGE_CUSTOMERS");
}

export function canViewSites(role: MatrixRole): boolean {
  return (
    hasMatrixPermission(role, "VIEW_SITES") ||
    hasMatrixPermission(role, "VIEW_CUSTOMERS")
  );
}

export function canManageSites(role: MatrixRole): boolean {
  return hasMatrixPermission(role, "MANAGE_SITES");
}

export function canManageContacts(role: MatrixRole): boolean {
  return hasMatrixPermission(role, "MANAGE_CONTACTS");
}

export function canManageContracts(role: MatrixRole): boolean {
  return hasMatrixPermission(role, "MANAGE_CONTRACTS");
}

export function canManageWarranties(role: MatrixRole): boolean {
  return hasMatrixPermission(role, "MANAGE_WARRANTIES");
}

export function canManageAssets(role: MatrixRole): boolean {
  return hasMatrixPermission(role, "MANAGE_ASSETS");
}

export function canUpdateAssetServiceInfo(role: MatrixRole): boolean {
  return (
    hasMatrixPermission(role, "UPDATE_ASSET_SERVICE_INFO") ||
    hasMatrixPermission(role, "MANAGE_ASSETS")
  );
}

export const CRM_PERMISSIONS: MatrixPermission[] = [
  "VIEW_CUSTOMERS",
  "MANAGE_CUSTOMERS",
  "VIEW_SITES",
  "MANAGE_SITES",
  "MANAGE_CONTACTS",
  "MANAGE_CONTRACTS",
  "MANAGE_WARRANTIES",
  "MANAGE_ASSETS",
  "UPDATE_ASSET_SERVICE_INFO",
];
