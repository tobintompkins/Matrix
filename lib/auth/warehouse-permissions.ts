import { hasMatrixPermission } from "./permissions";
import type { MatrixPermission, MatrixRole } from "./types";

/** Warehouse / enterprise inventory capability checks (Patch 43). */

export function canManageWarehouses(role: MatrixRole): boolean {
  return (
    hasMatrixPermission(role, "MANAGE_WAREHOUSES") ||
    hasMatrixPermission(role, "MANAGE_INVENTORY_SETTINGS") ||
    hasMatrixPermission(role, "MANAGE_SETTINGS")
  );
}

export function canApproveInventoryTransfers(role: MatrixRole): boolean {
  return (
    hasMatrixPermission(role, "APPROVE_INVENTORY_TRANSFERS") ||
    hasMatrixPermission(role, "TRANSFER_INVENTORY") ||
    hasMatrixPermission(role, "EDIT_INVENTORY")
  );
}

export function canViewInventoryCosts(role: MatrixRole): boolean {
  return (
    hasMatrixPermission(role, "VIEW_INVENTORY_COSTS") ||
    hasMatrixPermission(role, "VIEW_INVENTORY_REPORTS") ||
    hasMatrixPermission(role, "MANAGE_INVENTORY_SETTINGS")
  );
}

export function canDeleteInventoryRecords(role: MatrixRole): boolean {
  return hasMatrixPermission(role, "DELETE_INVENTORY");
}

export function canExportInventory(role: MatrixRole): boolean {
  return (
    hasMatrixPermission(role, "EXPORT_INVENTORY") ||
    hasMatrixPermission(role, "VIEW_INVENTORY_REPORTS") ||
    hasMatrixPermission(role, "VIEW_INVENTORY")
  );
}

export function canPrintInventoryReports(role: MatrixRole): boolean {
  return (
    hasMatrixPermission(role, "PRINT_INVENTORY_REPORTS") ||
    hasMatrixPermission(role, "VIEW_INVENTORY_REPORTS") ||
    hasMatrixPermission(role, "VIEW_INVENTORY")
  );
}

export function canApproveCycleCounts(role: MatrixRole): boolean {
  return (
    hasMatrixPermission(role, "APPROVE_CYCLE_COUNTS") ||
    hasMatrixPermission(role, "ADJUST_INVENTORY") ||
    hasMatrixPermission(role, "COUNT_INVENTORY")
  );
}

export function canRunReceivingWizard(role: MatrixRole): boolean {
  return (
    hasMatrixPermission(role, "RECEIVE_INVENTORY") ||
    hasMatrixPermission(role, "EDIT_INVENTORY")
  );
}

export const WAREHOUSE_PERMISSIONS: MatrixPermission[] = [
  "MANAGE_WAREHOUSES",
  "APPROVE_INVENTORY_TRANSFERS",
  "VIEW_INVENTORY_COSTS",
  "DELETE_INVENTORY",
  "EXPORT_INVENTORY",
  "PRINT_INVENTORY_REPORTS",
  "APPROVE_CYCLE_COUNTS",
];
