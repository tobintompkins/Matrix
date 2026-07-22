/**
 * Patch 50C-2 — Settings + retention + alert rule seeds.
 */

import { prisma } from "@/lib/db/prisma";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";

export type SystemLogSettings = {
  enabled: boolean;
  minimumStoredSeverity: string;
  apiRequestLoggingEnabled: boolean;
  successfulAuthLoggingEnabled: boolean;
  failedAuthLoggingEnabled: boolean;
  dataChangeLoggingEnabled: boolean;
  backgroundJobLoggingEnabled: boolean;
  integrationLoggingEnabled: boolean;
  notificationDeliveryLoggingEnabled: boolean;
  sensitiveMetadataVisibility: "RESTRICTED" | "ADMIN_ONLY";
  requestPayloadLoggingEnabled: boolean;
  responsePayloadLoggingEnabled: boolean;
  payloadSizeLimit: number;
  debugLoggingEnabled: boolean;
};

export const DEFAULT_SYSTEM_LOG_SETTINGS: SystemLogSettings = {
  enabled: true,
  minimumStoredSeverity: "INFO",
  apiRequestLoggingEnabled: true,
  successfulAuthLoggingEnabled: true,
  failedAuthLoggingEnabled: true,
  dataChangeLoggingEnabled: true,
  backgroundJobLoggingEnabled: true,
  integrationLoggingEnabled: true,
  notificationDeliveryLoggingEnabled: true,
  sensitiveMetadataVisibility: "RESTRICTED",
  requestPayloadLoggingEnabled: false,
  responsePayloadLoggingEnabled: false,
  payloadSizeLimit: 2048,
  debugLoggingEnabled: false,
};

export const DEFAULT_RETENTION: Record<string, number> = {
  SECURITY_CRITICAL: 365,
  AUDIT_LONG_TERM: 365,
  OPERATIONAL: 90,
  ERROR_DIAGNOSTIC: 60,
  DEBUG_SHORT_TERM: 14,
  EXPORT_RECORD: 90,
};

const SYSTEM_ALERT_RULES = [
  {
    code: "REPEATED_FAILED_LOGIN",
    name: "Repeated Failed Login",
    description: "Multiple authentication failure events within the window.",
    eventType: "AUTHENTICATION_FAILURE",
    threshold: 5,
    windowMinutes: 15,
    severity: "WARNING",
  },
  {
    code: "CROSS_ORG_ACCESS",
    name: "Cross-Organization Access Attempt",
    description: "Potential unauthorized cross-organization access attempt.",
    eventType: "CROSS_ORG_ACCESS_ATTEMPT",
    threshold: 1,
    windowMinutes: 60,
    severity: "CRITICAL",
  },
  {
    code: "PERMISSION_ESCALATION",
    name: "Permission Escalation",
    description: "Privileged role or permission change detected.",
    eventType: "PERMISSION_CHANGE",
    threshold: 1,
    windowMinutes: 60,
    severity: "WARNING",
  },
  {
    code: "API_ERROR_SPIKE",
    name: "Critical API Error Spike",
    description: "Elevated API or application error rate.",
    eventType: "API_ERROR",
    threshold: 10,
    windowMinutes: 15,
    severity: "ERROR",
  },
  {
    code: "JOB_FAILURE",
    name: "Background Job Failure",
    description: "Background or admin job failure recorded.",
    eventType: "JOB_FAILED",
    threshold: 1,
    windowMinutes: 60,
    severity: "ERROR",
  },
  {
    code: "INTEGRATION_FAILURE",
    name: "Integration Failure",
    description: "External integration failure recorded.",
    eventType: "INTEGRATION_FAILED",
    threshold: 1,
    windowMinutes: 60,
    severity: "ERROR",
  },
  {
    code: "SENSITIVE_EXPORT",
    name: "Sensitive Export",
    description: "Sensitive data export completed.",
    eventType: "SENSITIVE_EXPORT",
    threshold: 1,
    windowMinutes: 60,
    severity: "WARNING",
  },
];

export async function getSystemLogSettings(
  organizationId = DEFAULT_ORG_ID,
): Promise<SystemLogSettings> {
  const row = await prisma.systemLogSetting.findUnique({
    where: { organizationId },
  });
  if (!row) return structuredClone(DEFAULT_SYSTEM_LOG_SETTINGS);
  try {
    return {
      ...DEFAULT_SYSTEM_LOG_SETTINGS,
      ...(JSON.parse(row.settingsJson) as Partial<SystemLogSettings>),
    };
  } catch {
    return structuredClone(DEFAULT_SYSTEM_LOG_SETTINGS);
  }
}

export async function updateSystemLogSettings(input: {
  organizationId?: string;
  settings: Partial<SystemLogSettings>;
  actorUserId?: string;
}) {
  const organizationId = input.organizationId ?? DEFAULT_ORG_ID;
  const current = await getSystemLogSettings(organizationId);
  const next: SystemLogSettings = {
    ...current,
    ...input.settings,
    requestPayloadLoggingEnabled: false, // production-safe: never enable via API silently
    responsePayloadLoggingEnabled: false,
    debugLoggingEnabled: Boolean(input.settings.debugLoggingEnabled ?? current.debugLoggingEnabled),
  };
  // Allow explicit false/true for payload only if caller sets and we still force false in prod
  if (process.env.NODE_ENV !== "production") {
    if (input.settings.requestPayloadLoggingEnabled != null) {
      next.requestPayloadLoggingEnabled = input.settings.requestPayloadLoggingEnabled;
    }
  }
  return prisma.systemLogSetting.upsert({
    where: { organizationId },
    create: {
      organizationId,
      settingsJson: JSON.stringify(next),
      updatedByUserId: input.actorUserId ?? null,
    },
    update: {
      settingsJson: JSON.stringify(next),
      updatedByUserId: input.actorUserId ?? null,
    },
  });
}

export async function ensureSystemLogFoundation(organizationId = DEFAULT_ORG_ID) {
  for (const [retentionClass, days] of Object.entries(DEFAULT_RETENTION)) {
    const existing = await prisma.systemLogRetentionPolicy.findFirst({
      where: { organizationId, retentionClass },
    });
    if (existing) continue;
    await prisma.systemLogRetentionPolicy.create({
      data: { organizationId, retentionClass, days },
    });
  }
  for (const rule of SYSTEM_ALERT_RULES) {
    const existing = await prisma.systemLogAlertRule.findFirst({
      where: { organizationId, code: rule.code },
    });
    if (existing) continue;
    await prisma.systemLogAlertRule.create({
      data: {
        organizationId,
        ...rule,
        isActive: true,
        isSystemRule: true,
      },
    });
  }
  const settings = await prisma.systemLogSetting.findUnique({
    where: { organizationId },
  });
  if (!settings) {
    await prisma.systemLogSetting.create({
      data: {
        organizationId,
        settingsJson: JSON.stringify(DEFAULT_SYSTEM_LOG_SETTINGS),
      },
    });
  }
}

export async function getRetentionPolicies(organizationId: string) {
  await ensureSystemLogFoundation(organizationId);
  return prisma.systemLogRetentionPolicy.findMany({
    where: { organizationId },
    orderBy: { retentionClass: "asc" },
  });
}

export async function updateRetentionPolicy(input: {
  organizationId: string;
  retentionClass: string;
  days: number;
  actorUserId: string;
}) {
  if (!Number.isFinite(input.days) || input.days < 7 || input.days > 2555) {
    throw new Error("Retention days must be between 7 and 2555.");
  }
  await ensureSystemLogFoundation(input.organizationId);
  return prisma.systemLogRetentionPolicy.upsert({
    where: {
      organizationId_retentionClass: {
        organizationId: input.organizationId,
        retentionClass: input.retentionClass,
      },
    },
    create: {
      organizationId: input.organizationId,
      retentionClass: input.retentionClass,
      days: Math.floor(input.days),
      updatedByUserId: input.actorUserId,
    },
    update: {
      days: Math.floor(input.days),
      updatedByUserId: input.actorUserId,
    },
  });
}
