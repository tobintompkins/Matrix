/**
 * Patch 50B — Organization Health types and score engine (pure / testable).
 */

export const HEALTH_CALCULATION_VERSION = "50B.1";

export type HealthCategoryKey =
  | "fleet"
  | "service"
  | "pm"
  | "inventory"
  | "technician"
  | "customer"
  | "financial"
  | "security";

export type HealthClassification =
  | "Excellent"
  | "Healthy"
  | "Watch"
  | "At Risk"
  | "Critical"
  | "Not Available"
  | "Insufficient Data"
  | "Not Configured";

export type HealthCategoryWeights = Record<HealthCategoryKey, number>;

export type HealthThresholds = {
  excellentMin: number;
  healthyMin: number;
  watchMin: number;
  atRiskMin: number;
};

export type HealthSettings = {
  enabled: boolean;
  defaultDateRangeDays: number;
  weights: HealthCategoryWeights;
  enabledCategories: Record<HealthCategoryKey, boolean>;
  thresholds: HealthThresholds;
  cacheSeconds: number;
  snapshotRetentionDays: number;
  fleetAvailabilityWatchBelow: number;
  serviceSlaWatchBelow: number;
  pmComplianceWatchBelow: number;
  inventoryStockoutWatchAbove: number;
  technicianOverdueWatchAbove: number;
  customerCriticalCallsWatchAbove: number;
};

export const DEFAULT_HEALTH_WEIGHTS: HealthCategoryWeights = {
  fleet: 20,
  service: 20,
  pm: 15,
  inventory: 15,
  technician: 10,
  customer: 10,
  financial: 5,
  security: 5,
};

export const DEFAULT_HEALTH_THRESHOLDS: HealthThresholds = {
  excellentMin: 90,
  healthyMin: 80,
  watchMin: 70,
  atRiskMin: 60,
};

export const DEFAULT_HEALTH_SETTINGS: HealthSettings = {
  enabled: true,
  defaultDateRangeDays: 30,
  weights: { ...DEFAULT_HEALTH_WEIGHTS },
  enabledCategories: {
    fleet: true,
    service: true,
    pm: true,
    inventory: true,
    technician: true,
    customer: true,
    financial: true,
    security: true,
  },
  thresholds: { ...DEFAULT_HEALTH_THRESHOLDS },
  cacheSeconds: 60,
  snapshotRetentionDays: 365,
  fleetAvailabilityWatchBelow: 85,
  serviceSlaWatchBelow: 85,
  pmComplianceWatchBelow: 85,
  inventoryStockoutWatchAbove: 5,
  technicianOverdueWatchAbove: 8,
  customerCriticalCallsWatchAbove: 2,
};

export type CategoryScoreInput = {
  key: HealthCategoryKey;
  score: number | null;
  available: boolean;
  currentValue?: string | number | null;
  targetValue?: string | number | null;
  previousValue?: string | number | null;
  trend?: "up" | "down" | "flat" | "unknown";
  dataPeriod?: string;
  dataSource?: string;
  positiveFactors?: string[];
  negativeFactors?: string[];
  recommendedActions?: string[];
};

export type CategoryScoreResult = CategoryScoreInput & {
  classification: HealthClassification;
  weight: number;
  weightedContribution: number | null;
};

export type OverallHealthScore = {
  overallScore: number | null;
  classification: HealthClassification;
  categories: CategoryScoreResult[];
  weightTotal: number;
  calculationVersion: string;
  calculatedAt: string;
  explanation: string;
};

export function classifyScore(
  score: number | null,
  thresholds: HealthThresholds = DEFAULT_HEALTH_THRESHOLDS,
  available = true,
): HealthClassification {
  if (!available || score == null || !Number.isFinite(score)) {
    return "Not Available";
  }
  if (score >= thresholds.excellentMin) return "Excellent";
  if (score >= thresholds.healthyMin) return "Healthy";
  if (score >= thresholds.watchMin) return "Watch";
  if (score >= thresholds.atRiskMin) return "At Risk";
  return "Critical";
}

export function validateWeights(
  weights: HealthCategoryWeights,
  enabled: Record<HealthCategoryKey, boolean>,
): { ok: true; normalized: HealthCategoryWeights; total: number } | { ok: false; error: string } {
  const activeKeys = (Object.keys(weights) as HealthCategoryKey[]).filter(
    (k) => enabled[k],
  );
  if (activeKeys.length === 0) {
    return { ok: false, error: "At least one health category must be enabled." };
  }
  let total = 0;
  for (const key of activeKeys) {
    const w = weights[key];
    if (!Number.isFinite(w) || w < 0) {
      return { ok: false, error: `Invalid weight for ${key}.` };
    }
    total += w;
  }
  if (total <= 0) {
    return { ok: false, error: "Active category weights must sum to more than zero." };
  }
  // Normalize to 100 when totals differ (disabled categories excluded).
  const normalized = { ...weights };
  for (const key of Object.keys(weights) as HealthCategoryKey[]) {
    if (!enabled[key]) {
      normalized[key] = 0;
    } else {
      normalized[key] = Math.round((weights[key] / total) * 10000) / 100;
    }
  }
  const check = activeKeys.reduce((s, k) => s + normalized[k], 0);
  // Fix rounding drift on last active key
  const drift = Math.round((100 - check) * 100) / 100;
  if (Math.abs(drift) > 0 && activeKeys.length > 0) {
    normalized[activeKeys[activeKeys.length - 1]] =
      Math.round((normalized[activeKeys[activeKeys.length - 1]] + drift) * 100) / 100;
  }
  return { ok: true, normalized, total: 100 };
}

export function computeOverallHealthScore(
  inputs: CategoryScoreInput[],
  settings: HealthSettings = DEFAULT_HEALTH_SETTINGS,
  calculatedAt = new Date().toISOString(),
): OverallHealthScore {
  const weightGate = validateWeights(settings.weights, settings.enabledCategories);
  if (!weightGate.ok) {
    return {
      overallScore: null,
      classification: "Not Configured",
      categories: [],
      weightTotal: 0,
      calculationVersion: HEALTH_CALCULATION_VERSION,
      calculatedAt,
      explanation: weightGate.error,
    };
  }

  const byKey = new Map(inputs.map((i) => [i.key, i]));
  const categories: CategoryScoreResult[] = (
    Object.keys(weightGate.normalized) as HealthCategoryKey[]
  ).map((key) => {
    const weight = weightGate.normalized[key];
    const enabled = settings.enabledCategories[key];
    const input = byKey.get(key);
    const available = Boolean(enabled && input?.available && input.score != null);
    const score = available ? Number(input!.score) : null;
    const classification = !enabled
      ? ("Not Configured" as const)
      : classifyScore(score, settings.thresholds, available);
    const weightedContribution =
      available && score != null ? Math.round(score * (weight / 100) * 100) / 100 : null;
    return {
      key,
      score,
      available,
      currentValue: input?.currentValue ?? null,
      targetValue: input?.targetValue ?? null,
      previousValue: input?.previousValue ?? null,
      trend: input?.trend ?? "unknown",
      dataPeriod: input?.dataPeriod,
      dataSource: input?.dataSource,
      positiveFactors: input?.positiveFactors ?? [],
      negativeFactors: input?.negativeFactors ?? [],
      recommendedActions: input?.recommendedActions ?? [],
      classification,
      weight,
      weightedContribution,
    };
  });

  const scored = categories.filter((c) => c.available && c.weightedContribution != null);
  if (scored.length === 0) {
    return {
      overallScore: null,
      classification: "Insufficient Data",
      categories,
      weightTotal: 100,
      calculationVersion: HEALTH_CALCULATION_VERSION,
      calculatedAt,
      explanation:
        "No category produced a valid score. Missing data is labeled Insufficient Data rather than treated as zero.",
    };
  }

  // Re-normalize among available categories only so missing data does not drag to zero.
  const availableWeight = scored.reduce((s, c) => s + c.weight, 0);
  let overall = 0;
  for (const c of scored) {
    overall += (c.score as number) * (c.weight / availableWeight);
  }
  overall = Math.round(overall * 100) / 100;
  const classification = classifyScore(overall, settings.thresholds, true);

  return {
    overallScore: overall,
    classification,
    categories,
    weightTotal: 100,
    calculationVersion: HEALTH_CALCULATION_VERSION,
    calculatedAt,
    explanation: `Weighted average of ${scored.length} available categories (weights re-normalized among available data). Version ${HEALTH_CALCULATION_VERSION}.`,
  };
}

export function safePercentChange(
  current: number,
  previous: number | null | undefined,
): { absolute: number | null; percent: number | null; label: string } {
  if (previous == null || !Number.isFinite(previous)) {
    return { absolute: null, percent: null, label: "No Previous Data" };
  }
  const absolute = Math.round((current - previous) * 100) / 100;
  if (previous === 0) {
    return {
      absolute,
      percent: null,
      label: current === 0 ? "No Change" : "New",
    };
  }
  const percent = Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
  return { absolute, percent, label: `${percent > 0 ? "+" : ""}${percent}%` };
}
