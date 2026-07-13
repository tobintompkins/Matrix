import { hasMatrixPermission } from "./permissions";
import type { MatrixPermission, MatrixRole } from "./types";

/** Patch 44 — PM Intelligence capability checks. */

export function canViewPmIntelligence(role: MatrixRole): boolean {
  return (
    hasMatrixPermission(role, "VIEW_PM_INTELLIGENCE") ||
    hasMatrixPermission(role, "VIEW_FLEET_MAINTENANCE")
  );
}

export function canManagePmSettings(role: MatrixRole): boolean {
  return (
    hasMatrixPermission(role, "MANAGE_PM_SETTINGS") ||
    hasMatrixPermission(role, "EDIT_MAINTENANCE_INTERVALS") ||
    hasMatrixPermission(role, "MANAGE_SETTINGS")
  );
}

export function canImportMeterCounts(role: MatrixRole): boolean {
  return (
    hasMatrixPermission(role, "IMPORT_METER_COUNTS") ||
    hasMatrixPermission(role, "ENTER_COPY_COUNT")
  );
}

export function canOverrideMeterValidation(role: MatrixRole): boolean {
  return (
    hasMatrixPermission(role, "OVERRIDE_METER_VALIDATION") ||
    hasMatrixPermission(role, "CORRECT_MAINTENANCE_RECORDS")
  );
}

export function canViewPmForecasting(role: MatrixRole): boolean {
  return (
    hasMatrixPermission(role, "VIEW_PM_FORECASTING") ||
    hasMatrixPermission(role, "VIEW_FLEET_MAINTENANCE")
  );
}

export function canViewPmExecutive(role: MatrixRole): boolean {
  return (
    hasMatrixPermission(role, "VIEW_PM_EXECUTIVE") ||
    hasMatrixPermission(role, "VIEW_REPORTS") ||
    hasMatrixPermission(role, "VIEW_FLEET_MAINTENANCE")
  );
}

export const PM_INTELLIGENCE_PERMISSIONS: MatrixPermission[] = [
  "VIEW_PM_INTELLIGENCE",
  "MANAGE_PM_SETTINGS",
  "IMPORT_METER_COUNTS",
  "OVERRIDE_METER_VALIDATION",
  "VIEW_PM_FORECASTING",
  "VIEW_PM_EXECUTIVE",
];
