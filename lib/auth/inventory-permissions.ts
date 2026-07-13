import { hasMatrixPermission } from "./permissions";
import type { MatrixPermission, MatrixRole } from "./types";

/** Inventory capability checks mapped to Matrix roles (Patch 38). */

export function canViewInventory(role: MatrixRole): boolean {
  return hasMatrixPermission(role, "VIEW_INVENTORY");
}

export function canConsumeInventory(role: MatrixRole): boolean {
  return (
    hasMatrixPermission(role, "CONSUME_INVENTORY") ||
    hasMatrixPermission(role, "EDIT_INVENTORY")
  );
}

export function canReceiveInventory(role: MatrixRole): boolean {
  return (
    hasMatrixPermission(role, "RECEIVE_INVENTORY") ||
    hasMatrixPermission(role, "EDIT_INVENTORY")
  );
}

export function canTransferInventory(role: MatrixRole): boolean {
  return (
    hasMatrixPermission(role, "TRANSFER_INVENTORY") ||
    hasMatrixPermission(role, "EDIT_INVENTORY")
  );
}

export function canAdjustInventory(role: MatrixRole): boolean {
  return (
    hasMatrixPermission(role, "ADJUST_INVENTORY") ||
    hasMatrixPermission(role, "EDIT_INVENTORY")
  );
}

export function canCountTruckInventory(role: MatrixRole): boolean {
  return (
    hasMatrixPermission(role, "COUNT_INVENTORY") ||
    hasMatrixPermission(role, "VIEW_INVENTORY")
  );
}

export function canRequestParts(role: MatrixRole): boolean {
  return hasMatrixPermission(role, "CREATE_PARTS_ORDER");
}

export function canApprovePurchaseRequests(role: MatrixRole): boolean {
  return hasMatrixPermission(role, "APPROVE_PARTS_ORDER");
}

export function canReserveInventory(role: MatrixRole): boolean {
  return (
    hasMatrixPermission(role, "RESERVE_INVENTORY") ||
    hasMatrixPermission(role, "EDIT_INVENTORY") ||
    hasMatrixPermission(role, "CREATE_PARTS_ORDER")
  );
}

export function canConfigureInventory(role: MatrixRole): boolean {
  return (
    hasMatrixPermission(role, "MANAGE_INVENTORY_SETTINGS") ||
    hasMatrixPermission(role, "MANAGE_SETTINGS")
  );
}

export function canViewInventoryReports(role: MatrixRole): boolean {
  return (
    hasMatrixPermission(role, "VIEW_INVENTORY_REPORTS") ||
    hasMatrixPermission(role, "VIEW_REPORTS")
  );
}

export const INVENTORY_PERMISSIONS: MatrixPermission[] = [
  "VIEW_INVENTORY",
  "EDIT_INVENTORY",
  "CONSUME_INVENTORY",
  "RECEIVE_INVENTORY",
  "TRANSFER_INVENTORY",
  "ADJUST_INVENTORY",
  "COUNT_INVENTORY",
  "RESERVE_INVENTORY",
  "CREATE_PARTS_ORDER",
  "APPROVE_PARTS_ORDER",
  "MANAGE_INVENTORY_SETTINGS",
  "VIEW_INVENTORY_REPORTS",
  "VIEW_SCANNER",
];
