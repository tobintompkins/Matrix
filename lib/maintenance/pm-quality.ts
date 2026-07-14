/**
 * Patch 46 — PM quality score (0–100).
 * Centralized scoring used by completion, history, and reports.
 */

import type { PmPartUsed, PmWorkflowChecklistItem } from "./pm-checklist";

export type PmQualityScoreInput = {
  checklist: PmWorkflowChecklistItem[];
  notes?: string | null;
  partsUsed?: PmPartUsed[];
  meterRecorded: boolean;
  laborMinutes: number | null;
};

/**
 * Exact scoring formula (weights sum to 100):
 *
 * 1. Required checklist (max 50)
 *    - Each required item DONE counts fully
 *    - Each required item SKIPPED with a documented reason counts as 0.5
 *    - Pending / skip-without-reason required items count as 0
 *    - Score = (weighted required / required count) × 50
 *
 * 2. Overall checklist completion (max 20)
 *    - Score = (DONE items / total items) × 20
 *    - SKIPPED items do not count toward this bucket
 *
 * 3. Notes present (max 10)
 *    - 10 if general technician notes are non-empty; otherwise 0
 *    - Presence only — note length is not scored
 *
 * 4. Meter recorded (max 10)
 *    - 10 if a meter reading was recorded with the completion; otherwise 0
 *
 * 5. Labor time recorded (max 5)
 *    - 5 if labor minutes were calculated (valid start/finish); otherwise 0
 *
 * 6. Parts documentation (max 5)
 *    - 5 if no parts were used, OR every part has part number, description,
 *      and quantity > 0; otherwise 0
 *
 * Final score = round(clamp(sum, 0..100), 1 decimal)
 */
export const PM_QUALITY_SCORE_FORMULA = {
  version: "46.1",
  weights: {
    requiredChecklist: 50,
    overallChecklistDone: 20,
    notesPresent: 10,
    meterRecorded: 10,
    laborRecorded: 5,
    partsDocumented: 5,
  },
  rules: [
    "Required items: DONE = 1.0, SKIPPED with reason = 0.5, otherwise 0",
    "Overall bucket counts only DONE items (skips do not add to this bucket)",
    "Notes score is binary (present / absent); length is not scored",
    "Parts score is binary validity of the parts list (empty list is valid)",
  ],
} as const;

export function calculatePmQualityScore(input: PmQualityScoreInput): number {
  const items = input.checklist;
  const required = items.filter((i) => i.required);
  const requiredDone = required.filter((i) => i.status === "DONE").length;
  const requiredSkippedOk = required.filter(
    (i) => i.status === "SKIPPED" && i.skipReason.trim(),
  ).length;
  const requiredScore =
    required.length === 0
      ? 50
      : ((requiredDone + requiredSkippedOk * 0.5) / required.length) * 50;

  const doneAll = items.filter((i) => i.status === "DONE").length;
  const overallScore =
    items.length === 0 ? 20 : (doneAll / items.length) * 20;

  const notesScore = input.notes?.trim() ? 10 : 0;
  const meterScore = input.meterRecorded ? 10 : 0;
  const laborScore =
    input.laborMinutes != null && input.laborMinutes >= 0 ? 5 : 0;

  const parts = input.partsUsed ?? [];
  const partsValid =
    parts.length === 0 ||
    parts.every(
      (p) =>
        p.partNumber.trim() &&
        p.description.trim() &&
        Number.isFinite(p.quantity) &&
        p.quantity > 0,
    );
  const partsScore = partsValid ? 5 : 0;

  const total =
    requiredScore +
    overallScore +
    notesScore +
    meterScore +
    laborScore +
    partsScore;

  return Math.round(Math.min(100, Math.max(0, total)) * 10) / 10;
}
