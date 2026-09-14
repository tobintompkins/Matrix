/**
 * Patch 51C.1 / 51C.2 — Soft-disable flags for Enterprise Intelligence extensions.
 * Core ECC remains available when these flags are off.
 */

export function isEnterpriseIntelligence51c1Enabled(): boolean {
  const raw = (process.env.ENTERPRISE_INTELLIGENCE_51C1 ?? "true")
    .trim()
    .toLowerCase();
  return raw !== "0" && raw !== "false" && raw !== "off" && raw !== "no";
}

/** Patch 51C.2 — Predictive Business Analytics extensions. */
export function isPredictiveBusinessAnalytics51c2Enabled(): boolean {
  const raw = (process.env.PREDICTIVE_BUSINESS_ANALYTICS_51C2 ?? "true")
    .trim()
    .toLowerCase();
  return raw !== "0" && raw !== "false" && raw !== "off" && raw !== "no";
}

/** Patch 51C.3 — Executive AI Copilot (extends ECC AI Ask; not a new assistant). */
export function isExecutiveAiCopilot51c3Enabled(): boolean {
  const raw = (process.env.EXECUTIVE_AI_COPILOT_51C3 ?? "true")
    .trim()
    .toLowerCase();
  return raw !== "0" && raw !== "false" && raw !== "off" && raw !== "no";
}
