/**
 * Patch 51A.3 — Pure scoring profile helpers (no Prisma).
 */

import {
  DEFAULT_PREDICTIVE_SETTINGS,
  DEFAULT_WEIGHTS,
  type DefaultPredictiveSettings,
} from "./types";

export type ScoringWeights = typeof DEFAULT_WEIGHTS;

export function parseScoringWeights(
  weightsJson: string | null | undefined,
): ScoringWeights {
  try {
    const raw = JSON.parse(weightsJson || "{}") as Partial<ScoringWeights>;
    return { ...DEFAULT_WEIGHTS, ...raw };
  } catch {
    return { ...DEFAULT_WEIGHTS };
  }
}

export function applyProfileThresholds(
  settings: DefaultPredictiveSettings,
  thresholdsJson: string | null | undefined,
): DefaultPredictiveSettings {
  try {
    const t = JSON.parse(thresholdsJson || "{}") as {
      warning?: number;
      critical?: number;
    };
    return {
      ...settings,
      healthScoreWarningThreshold:
        typeof t.warning === "number"
          ? t.warning
          : settings.healthScoreWarningThreshold,
      healthScoreCriticalThreshold:
        typeof t.critical === "number"
          ? t.critical
          : settings.healthScoreCriticalThreshold,
    };
  } catch {
    return settings;
  }
}

export function defaultThresholdsJson(): string {
  return JSON.stringify({
    warning: DEFAULT_PREDICTIVE_SETTINGS.healthScoreWarningThreshold,
    critical: DEFAULT_PREDICTIVE_SETTINGS.healthScoreCriticalThreshold,
  });
}
