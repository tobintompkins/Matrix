/**
 * Patch 51A.3 — Explainable risk detectors.
 */

import type {
  DefaultPredictiveSettings,
  MachinePredictiveInput,
  PredictiveRiskFactor,
} from "./types";
import { DEFAULT_PREDICTIVE_SETTINGS, DEFAULT_WEIGHTS } from "./types";

function daysBetween(a: string, b: string): number {
  return Math.abs(
    (new Date(a).getTime() - new Date(b).getTime()) / 86_400_000,
  );
}

function normalizeIssue(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 80);
}

export function detectRiskFactors(
  input: MachinePredictiveInput,
  settings: DefaultPredictiveSettings = DEFAULT_PREDICTIVE_SETTINGS,
  weights: typeof DEFAULT_WEIGHTS = DEFAULT_WEIGHTS,
): PredictiveRiskFactor[] {
  const factors: PredictiveRiskFactor[] = [];
  const now = new Date();
  const lookbackMs = settings.repeatFailureLookbackDays * 86_400_000;
  const recentCalls = input.serviceCalls.filter(
    (c) => now.getTime() - new Date(c.createdAt).getTime() <= lookbackMs,
  );

  // Repeat failure by issue title
  const byTheme = new Map<string, typeof recentCalls>();
  for (const c of recentCalls) {
    const key = normalizeIssue(c.issueTitle || c.symptoms || "unknown");
    const list = byTheme.get(key) ?? [];
    list.push(c);
    byTheme.set(key, list);
  }
  for (const [theme, calls] of byTheme) {
    if (calls.length >= settings.repeatFailureThreshold) {
      factors.push({
        key: "REPEAT_FAILURE",
        severity: calls.length >= settings.repeatFailureThreshold + 1 ? "CRITICAL" : "HIGH",
        scoreImpact: weights.repeatFailure,
        confidence: 75,
        title: "Repeat service issue pattern",
        explanation: `${calls.length} service calls with similar theme ("${theme}") in ${settings.repeatFailureLookbackDays} days.`,
        evidence: calls.slice(0, 5).map((c) => ({
          entityType: "ServiceCall",
          entityId: c.id,
          date: c.createdAt.slice(0, 10),
          summary: c.issueTitle || c.status,
        })),
      });
    }
  }

  const openEmergency = input.serviceCalls.filter(
    (c) =>
      !["CLOSED", "CANCELLED", "RESOLVED"].includes(c.status) &&
      (c.isEmergency || c.priority === "EMERGENCY" || c.priority === "CRITICAL"),
  );
  if (openEmergency.length) {
    factors.push({
      key: "OPEN_EMERGENCY",
      severity: "CRITICAL",
      scoreImpact: weights.openEmergency,
      confidence: 90,
      title: "Open emergency / critical service call",
      explanation: `${openEmergency.length} open high-priority service call(s).`,
      evidence: openEmergency.slice(0, 3).map((c) => ({
        entityType: "ServiceCall",
        entityId: c.id,
        date: c.createdAt.slice(0, 10),
        summary: `${c.priority}: ${c.issueTitle}`,
      })),
    });
  }

  // PM overdue by meter
  if (
    input.currentMeterCount != null &&
    input.nextPmDueCount != null &&
    input.currentMeterCount > input.nextPmDueCount
  ) {
    const overdueBy = input.currentMeterCount - input.nextPmDueCount;
    factors.push({
      key: "PM_OVERDUE",
      severity: overdueBy > (input.pmInterval ?? 10000) * 0.2 ? "CRITICAL" : "HIGH",
      scoreImpact: weights.pmOverdue,
      confidence: 85,
      title: "PM overdue by meter",
      explanation: `Current meter ${input.currentMeterCount} exceeds due meter ${input.nextPmDueCount} by ${overdueBy}.`,
      evidence: [
        {
          entityType: "MachinePmState",
          entityId: input.machineId,
          summary: `Overdue by ${overdueBy} impressions`,
        },
      ],
    });
  }

  // Stale meter
  if (input.meterHistory.length) {
    const last = input.meterHistory[input.meterHistory.length - 1];
    const ageDays = daysBetween(last.recordedAt, now.toISOString());
    if (ageDays > settings.staleMeterDays) {
      factors.push({
        key: "STALE_METER",
        severity: "WARNING",
        scoreImpact: weights.staleMeter,
        confidence: 80,
        title: "Stale meter reading",
        explanation: `Last meter reading was ${Math.floor(ageDays)} days ago (threshold ${settings.staleMeterDays}).`,
        evidence: [
          {
            entityType: "MeterReading",
            date: last.recordedAt.slice(0, 10),
            summary: `Meter ${last.meterCount}`,
          },
        ],
      });
    }
  } else {
    factors.push({
      key: "MISSING_METER",
      severity: "WARNING",
      scoreImpact: weights.staleMeter,
      confidence: 70,
      title: "Missing meter history",
      explanation: "No meter readings available for usage or PM distance calculation.",
      evidence: [],
    });
  }

  // Usage spike (recent vs earlier)
  if (input.meterHistory.length >= 4) {
    const sorted = [...input.meterHistory].sort((a, b) =>
      a.recordedAt.localeCompare(b.recordedAt),
    );
    const mid = Math.floor(sorted.length / 2);
    const early = sorted.slice(0, mid);
    const late = sorted.slice(mid);
    const earlyRate = rateForSegment(early);
    const lateRate = rateForSegment(late);
    if (
      earlyRate != null &&
      lateRate != null &&
      earlyRate > 0 &&
      ((lateRate - earlyRate) / earlyRate) * 100 >= settings.usageSpikePercent
    ) {
      factors.push({
        key: "USAGE_SPIKE",
        severity: "WARNING",
        scoreImpact: weights.usageSpike,
        confidence: 65,
        title: "Rapid usage increase",
        explanation: `Recent usage rate rose ~${Math.round(((lateRate - earlyRate) / earlyRate) * 100)}% vs earlier period.`,
        evidence: [],
      });
    }
  }

  if (input.machineStatus === "DOWN") {
    factors.push({
      key: "MACHINE_DOWN",
      severity: "CRITICAL",
      scoreImpact: 20,
      confidence: 95,
      title: "Machine reported down",
      explanation: "Machine operational status is DOWN.",
      evidence: [{ entityType: "Machine", entityId: input.machineId, summary: "Status DOWN" }],
    });
  }

  return factors;
}

function rateForSegment(
  segment: MachinePredictiveInput["meterHistory"],
): number | null {
  if (segment.length < 2) return null;
  const first = segment[0];
  const last = segment[segment.length - 1];
  const days = Math.max(
    1,
    (new Date(last.recordedAt).getTime() - new Date(first.recordedAt).getTime()) /
      86_400_000,
  );
  const delta = last.meterCount - first.meterCount;
  if (delta < 0) return null;
  return delta / days;
}
