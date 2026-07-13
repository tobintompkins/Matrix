import { hasMatrixPermission } from "./permissions";
import type { MatrixPermission, MatrixRole } from "./types";

export function canViewField(role: MatrixRole): boolean {
  return hasMatrixPermission(role, "VIEW_FIELD");
}

export function canUseOfflineField(role: MatrixRole): boolean {
  return hasMatrixPermission(role, "USE_OFFLINE_FIELD");
}

export function canDownloadOfflinePackages(role: MatrixRole): boolean {
  return (
    hasMatrixPermission(role, "DOWNLOAD_OFFLINE_PACKAGES") ||
    hasMatrixPermission(role, "USE_OFFLINE_FIELD")
  );
}

export function canSyncFieldQueue(role: MatrixRole): boolean {
  return (
    hasMatrixPermission(role, "SYNC_FIELD_QUEUE") ||
    hasMatrixPermission(role, "USE_OFFLINE_FIELD")
  );
}

export function canResolveFieldConflicts(role: MatrixRole): boolean {
  return hasMatrixPermission(role, "RESOLVE_FIELD_CONFLICTS");
}

export function canConfigureOfflinePolicies(role: MatrixRole): boolean {
  return hasMatrixPermission(role, "CONFIGURE_OFFLINE_POLICIES");
}

export function canViewOtherTechniciansField(role: MatrixRole): boolean {
  return (
    hasMatrixPermission(role, "VIEW_FIELD_ALL_TECHNICIANS") ||
    hasMatrixPermission(role, "MANAGE_WORK_ORDERS")
  );
}

export const FIELD_PERMISSIONS: MatrixPermission[] = [
  "VIEW_FIELD",
  "USE_OFFLINE_FIELD",
  "DOWNLOAD_OFFLINE_PACKAGES",
  "SYNC_FIELD_QUEUE",
  "RESOLVE_FIELD_CONFLICTS",
  "CONFIGURE_OFFLINE_POLICIES",
  "VIEW_FIELD_ALL_TECHNICIANS",
];
