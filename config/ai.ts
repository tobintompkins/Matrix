/**
 * Patch 51A.1 Part 1 — AI Operations Center configuration.
 * No external model providers are connected yet.
 */

export const aiConfig = {
  enabled: true,
  learningEnabled: true,
  predictionEngineEnabled: true,
  recommendationsEnabled: true,
  /** Chat remains stubbed until a later 51A.1 part. */
  chatEnabled: false,
  /** Patch 51A.1 Part 3 — grounded NL assistant (deterministic search; no external LLM required). */
  assistantEnabled: true,
  assistantMaxQuestionLength: 2000,
  assistantMaxResults: 25,
  assistantMaxSources: 15,
  assistantRateLimitPerMinute: 30,
  assistantVersion: "assistant-v1",
  defaultConfidence: 98,
  maxSessionHistory: 100,
  version: "Matrix AI Core 1.0",
  engineName: "Matrix AI Engine",
  rulesVersion: "ai-ops-rules-51a1.2",
  analysisVersion: "analysis-v1",
} as const;

export type AiConfig = typeof aiConfig;
