/**
 * Patch 48 — Matrix Assist configuration (server-side only for secrets).
 */

import {
  MATRIX_ASSIST_DISCLAIMER,
  MATRIX_ASSIST_SUBTITLE,
} from "./constants";

export { MATRIX_ASSIST_DISCLAIMER, MATRIX_ASSIST_SUBTITLE };
export type AiProviderName = "none" | "sample" | "openai-compatible";

export function isMatrixAssistEnvEnabled(): boolean {
  const raw = (process.env.AI_ASSIST_ENABLED ?? "true").trim().toLowerCase();
  return raw !== "false" && raw !== "0" && raw !== "off";
}

export function isMatrixAssistDevSampleEnabled(): boolean {
  const raw = (process.env.AI_ASSIST_DEV_SAMPLE ?? "").trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "on";
}

export function getAiApiKey(): string | null {
  const key = process.env.AI_API_KEY?.trim();
  return key ? key : null;
}

export function getAiModel(): string {
  return process.env.AI_MODEL?.trim() || "gpt-4o-mini";
}

export function getAiProviderName(): AiProviderName {
  if (!isMatrixAssistEnvEnabled()) return "none";
  const named = (process.env.AI_PROVIDER ?? "").trim().toLowerCase();
  if (getAiApiKey()) {
    if (named === "openai" || named === "openai-compatible" || named === "") {
      return "openai-compatible";
    }
    return "openai-compatible";
  }
  if (isMatrixAssistDevSampleEnabled()) return "sample";
  return "none";
}

export function getMatrixAssistPublicStatus(): {
  enabled: boolean;
  configured: boolean;
  provider: AiProviderName;
  sampleMode: boolean;
  message: string | null;
} {
  const enabled = isMatrixAssistEnvEnabled();
  if (!enabled) {
    return {
      enabled: false,
      configured: false,
      provider: "none",
      sampleMode: false,
      message: "Matrix Assist is disabled in this environment.",
    };
  }
  const provider = getAiProviderName();
  if (provider === "none") {
    return {
      enabled: true,
      configured: false,
      provider: "none",
      sampleMode: false,
      message: "Matrix Assist is not configured in this environment.",
    };
  }
  return {
    enabled: true,
    configured: true,
    provider,
    sampleMode: provider === "sample",
    message:
      provider === "sample"
        ? "Development sample guidance is active. Responses are deterministic and clearly marked — not live AI."
        : null,
  };
}
