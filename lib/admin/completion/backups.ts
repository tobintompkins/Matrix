/**
 * Patch 49C — Backup status visibility (honest).
 */

import type { HealthLevel } from "./system-health";

export type BackupStatusInfo = {
  status: HealthLevel;
  provider: string;
  enabled: boolean;
  summary: string;
  lastSuccessfulBackup: string | null;
  lastFailedBackup: string | null;
  frequency: string;
  retentionPolicy: string;
  verificationStatus: string;
  nextScheduledBackup: string | null;
  environment: string;
  manualBackupAvailable: boolean;
  restoreAvailable: boolean;
  documentation: string;
};

export function getBackupStatus(): BackupStatusInfo {
  const env = process.env.NODE_ENV ?? "development";
  return {
    status: "Configuration Required",
    provider: "Hosting provider / DBA process",
    enabled: false,
    summary:
      "Matrix does not verify hosted backups automatically. Backup status must be confirmed with your hosting provider or DBA.",
    lastSuccessfulBackup: null,
    lastFailedBackup: null,
    frequency: "Managed outside Matrix",
    retentionPolicy: "Managed outside Matrix",
    verificationStatus: "Not verified by Matrix",
    nextScheduledBackup: null,
    environment: env,
    manualBackupAvailable: false,
    restoreAvailable: false,
    documentation:
      "Manual backup is managed by the hosting provider and is not available from Matrix. Production restore is not exposed in the Administration Center.",
  };
}

export function requestManualBackup(): { ok: false; error: string } {
  return {
    ok: false,
    error:
      "Manual backup is managed by the hosting provider and is not available from Matrix.",
  };
}
