import { prisma } from "@/lib/db/prisma";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import {
  DEFAULT_DQ_SETTINGS,
  type DataQualitySettings,
  validateDimensionWeights,
} from "./score";

export async function getDataQualitySettings(
  organizationId = DEFAULT_ORG_ID,
): Promise<DataQualitySettings> {
  const row = await prisma.dataQualitySetting.findUnique({
    where: { organizationId },
  });
  if (!row) return structuredClone(DEFAULT_DQ_SETTINGS);
  try {
    const parsed = JSON.parse(row.settingsJson) as Partial<DataQualitySettings>;
    return {
      ...DEFAULT_DQ_SETTINGS,
      ...parsed,
      dimensionWeights: {
        ...DEFAULT_DQ_SETTINGS.dimensionWeights,
        ...(parsed.dimensionWeights ?? {}),
      },
    };
  } catch {
    return structuredClone(DEFAULT_DQ_SETTINGS);
  }
}

export async function updateDataQualitySettings(input: {
  organizationId?: string;
  settings: Partial<DataQualitySettings>;
  actorUserId?: string;
}) {
  const organizationId = input.organizationId ?? DEFAULT_ORG_ID;
  const current = await getDataQualitySettings(organizationId);
  const next: DataQualitySettings = {
    ...current,
    ...input.settings,
    dimensionWeights: {
      ...current.dimensionWeights,
      ...(input.settings.dimensionWeights ?? {}),
    },
  };
  const gate = validateDimensionWeights(next.dimensionWeights);
  if (!gate.ok) throw new Error(gate.error);
  next.dimensionWeights = gate.normalized;
  if (next.automaticScanEnabled) {
    // No scheduler claimed — keep flag but document limitation.
  }
  return prisma.dataQualitySetting.upsert({
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
