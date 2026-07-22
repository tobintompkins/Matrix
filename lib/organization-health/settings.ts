/**
 * Patch 50B — Organization Health settings (org-scoped JSON, PortalConfiguration pattern).
 */

import { prisma } from "@/lib/db/prisma";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import {
  DEFAULT_HEALTH_SETTINGS,
  type HealthSettings,
  validateWeights,
} from "./score";

export async function getOrganizationHealthSettings(
  organizationId = DEFAULT_ORG_ID,
): Promise<HealthSettings> {
  const row = await prisma.organizationHealthSetting.findUnique({
    where: { organizationId },
  });
  if (!row) return structuredClone(DEFAULT_HEALTH_SETTINGS);
  try {
    return {
      ...DEFAULT_HEALTH_SETTINGS,
      ...(JSON.parse(row.settingsJson) as Partial<HealthSettings>),
      weights: {
        ...DEFAULT_HEALTH_SETTINGS.weights,
        ...((JSON.parse(row.settingsJson) as Partial<HealthSettings>).weights ??
          {}),
      },
      enabledCategories: {
        ...DEFAULT_HEALTH_SETTINGS.enabledCategories,
        ...((JSON.parse(row.settingsJson) as Partial<HealthSettings>)
          .enabledCategories ?? {}),
      },
      thresholds: {
        ...DEFAULT_HEALTH_SETTINGS.thresholds,
        ...((JSON.parse(row.settingsJson) as Partial<HealthSettings>)
          .thresholds ?? {}),
      },
    };
  } catch {
    return structuredClone(DEFAULT_HEALTH_SETTINGS);
  }
}

export async function updateOrganizationHealthSettings(input: {
  organizationId?: string;
  settings: Partial<HealthSettings>;
  actorUserId?: string;
}) {
  const organizationId = input.organizationId ?? DEFAULT_ORG_ID;
  const current = await getOrganizationHealthSettings(organizationId);
  const next: HealthSettings = {
    ...current,
    ...input.settings,
    weights: { ...current.weights, ...(input.settings.weights ?? {}) },
    enabledCategories: {
      ...current.enabledCategories,
      ...(input.settings.enabledCategories ?? {}),
    },
    thresholds: {
      ...current.thresholds,
      ...(input.settings.thresholds ?? {}),
    },
  };

  const weightGate = validateWeights(next.weights, next.enabledCategories);
  if (!weightGate.ok) throw new Error(weightGate.error);
  next.weights = weightGate.normalized;

  if (next.cacheSeconds < 0 || next.snapshotRetentionDays < 1) {
    throw new Error("Invalid retention or cache duration.");
  }

  return prisma.organizationHealthSetting.upsert({
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
