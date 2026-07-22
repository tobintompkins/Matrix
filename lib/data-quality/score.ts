/**
 * Patch 50C-1 — Data Quality Center types and score engine.
 */

export const DATA_QUALITY_CALC_VERSION = "50C1.1";

export type DataQualityDimension =
  | "completeness"
  | "validity"
  | "uniqueness"
  | "relationshipIntegrity"
  | "timeliness";

export type DataQualityModule =
  | "customers"
  | "contacts"
  | "locations"
  | "machines"
  | "serviceCalls"
  | "pm"
  | "meters"
  | "parts"
  | "inventory"
  | "partsOrders"
  | "users"
  | "portal"
  | "approvals";

export type DataQualityIssueType =
  | "DUPLICATE"
  | "MISSING_REQUIRED_VALUE"
  | "INVALID_VALUE"
  | "ORPHANED_RECORD"
  | "BROKEN_RELATIONSHIP"
  | "INCONSISTENT_STATUS"
  | "CONFLICTING_VALUE"
  | "STALE_DATA"
  | "OUTLIER"
  | "SEQUENCE_ERROR"
  | "UNAUTHORIZED_REFERENCE"
  | "FORMAT_ERROR"
  | "BUSINESS_RULE_VIOLATION"
  | "POSSIBLE_MERGE"
  | "MANUAL_REVIEW";

export type DataQualitySeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

export type DataQualityIssueStatus =
  | "OPEN"
  | "ASSIGNED"
  | "IN_REVIEW"
  | "FIX_PENDING"
  | "RESOLVED"
  | "DISMISSED"
  | "FALSE_POSITIVE"
  | "REOPENED";

export type DataQualityClassification =
  | "Excellent"
  | "Healthy"
  | "Needs Attention"
  | "At Risk"
  | "Critical"
  | "Insufficient Data"
  | "Not Available";

export type DimensionWeights = Record<DataQualityDimension, number>;

export type DataQualitySettings = {
  enabled: boolean;
  dimensionWeights: DimensionWeights;
  excellentMin: number;
  healthyMin: number;
  needsAttentionMin: number;
  atRiskMin: number;
  duplicateConfidenceThreshold: number;
  meterOutlierJumpPct: number;
  staleDays: number;
  scanBatchSize: number;
  automaticScanEnabled: boolean;
};

export const DEFAULT_DQ_WEIGHTS: DimensionWeights = {
  completeness: 30,
  validity: 25,
  uniqueness: 20,
  relationshipIntegrity: 15,
  timeliness: 10,
};

export const DEFAULT_DQ_SETTINGS: DataQualitySettings = {
  enabled: true,
  dimensionWeights: { ...DEFAULT_DQ_WEIGHTS },
  excellentMin: 95,
  healthyMin: 85,
  needsAttentionMin: 70,
  atRiskMin: 50,
  duplicateConfidenceThreshold: 0.85,
  meterOutlierJumpPct: 200,
  staleDays: 90,
  scanBatchSize: 500,
  automaticScanEnabled: false,
};

export type DetectedFinding = {
  issueKey: string;
  module: DataQualityModule;
  entityType: string;
  entityId: string;
  secondaryEntityId?: string | null;
  issueType: DataQualityIssueType;
  severity: DataQualitySeverity;
  title: string;
  description: string;
  fieldName?: string | null;
  currentValue?: string | null;
  expectedValue?: string | null;
  evidence?: string | null;
  confidenceScore?: number | null;
  ruleCode: string;
};

export type DimensionScoreInput = {
  dimension: DataQualityDimension;
  score: number | null;
  available: boolean;
  openIssues: number;
  criticalIssues: number;
  notes?: string[];
};

export function classifyDataHealth(
  score: number | null,
  settings: DataQualitySettings = DEFAULT_DQ_SETTINGS,
): DataQualityClassification {
  if (score == null || !Number.isFinite(score)) return "Not Available";
  if (score >= settings.excellentMin) return "Excellent";
  if (score >= settings.healthyMin) return "Healthy";
  if (score >= settings.needsAttentionMin) return "Needs Attention";
  if (score >= settings.atRiskMin) return "At Risk";
  return "Critical";
}

export function validateDimensionWeights(
  weights: DimensionWeights,
): { ok: true; normalized: DimensionWeights } | { ok: false; error: string } {
  const keys = Object.keys(weights) as DataQualityDimension[];
  let total = 0;
  for (const k of keys) {
    if (!Number.isFinite(weights[k]) || weights[k] < 0) {
      return { ok: false, error: `Invalid weight for ${k}` };
    }
    total += weights[k];
  }
  if (total <= 0) return { ok: false, error: "Weights must sum above zero." };
  const normalized = { ...weights };
  for (const k of keys) {
    normalized[k] = Math.round((weights[k] / total) * 10000) / 100;
  }
  const check = keys.reduce((s, k) => s + normalized[k], 0);
  const drift = Math.round((100 - check) * 100) / 100;
  if (keys.length) {
    normalized[keys[keys.length - 1]] =
      Math.round((normalized[keys[keys.length - 1]] + drift) * 100) / 100;
  }
  return { ok: true, normalized };
}

export function computeDataHealthScore(
  inputs: DimensionScoreInput[],
  settings: DataQualitySettings = DEFAULT_DQ_SETTINGS,
  calculatedAt = new Date().toISOString(),
) {
  const gate = validateDimensionWeights(settings.dimensionWeights);
  if (!gate.ok) {
    return {
      overallScore: null as number | null,
      classification: "Not Available" as DataQualityClassification,
      dimensions: [] as Array<DimensionScoreInput & { weight: number; contribution: number | null; classification: DataQualityClassification }>,
      calculationVersion: DATA_QUALITY_CALC_VERSION,
      calculatedAt,
      explanation: gate.error,
    };
  }
  const byDim = new Map(inputs.map((i) => [i.dimension, i]));
  const dimensions = (Object.keys(gate.normalized) as DataQualityDimension[]).map(
    (dimension) => {
      const weight = gate.normalized[dimension];
      const input = byDim.get(dimension);
      const available = Boolean(input?.available && input.score != null);
      const score = available ? Number(input!.score) : null;
      const contribution =
        available && score != null
          ? Math.round(score * (weight / 100) * 100) / 100
          : null;
      return {
        dimension,
        score,
        available,
        openIssues: input?.openIssues ?? 0,
        criticalIssues: input?.criticalIssues ?? 0,
        notes: input?.notes ?? [],
        weight,
        contribution,
        classification: classifyDataHealth(score, settings),
      };
    },
  );
  const scored = dimensions.filter((d) => d.available && d.contribution != null);
  if (!scored.length) {
    return {
      overallScore: null,
      classification: "Insufficient Data" as DataQualityClassification,
      dimensions,
      calculationVersion: DATA_QUALITY_CALC_VERSION,
      calculatedAt,
      explanation:
        "No dimension produced a valid score. Missing data is not treated as zero.",
    };
  }
  const availableWeight = scored.reduce((s, d) => s + d.weight, 0);
  let overall = 0;
  for (const d of scored) {
    overall += (d.score as number) * (d.weight / availableWeight);
  }
  overall = Math.round(overall * 100) / 100;
  return {
    overallScore: overall,
    classification: classifyDataHealth(overall, settings),
    dimensions,
    calculationVersion: DATA_QUALITY_CALC_VERSION,
    calculatedAt,
    explanation: `Weighted average of ${scored.length} available quality dimensions (re-normalized). Version ${DATA_QUALITY_CALC_VERSION}.`,
  };
}

export function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s._\-/#]+/g, "")
    .replace(/[^a-z0-9@+]/g, "");
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizePhone(value: string): string {
  return value.replace(/\D+/g, "");
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
