import type { DispatchPriority, SlaRule, SlaSnapshot, SlaState } from "./types";

export const DEFAULT_SLA_RULES: SlaRule[] = [
  {
    id: "sla-critical",
    name: "Critical response",
    priority: "CRITICAL",
    responseMinutes: 30,
    assignmentMinutes: 15,
    arrivalMinutes: 120,
    resolutionMinutes: 480,
    escalationMinutes: 45,
    weekendCoverage: true,
    enabled: true,
  },
  {
    id: "sla-high",
    name: "High priority",
    priority: "HIGH",
    responseMinutes: 60,
    assignmentMinutes: 30,
    arrivalMinutes: 240,
    resolutionMinutes: 960,
    escalationMinutes: 90,
    weekendCoverage: true,
    enabled: true,
  },
  {
    id: "sla-normal",
    name: "Normal priority",
    priority: "NORMAL",
    responseMinutes: 240,
    assignmentMinutes: 120,
    arrivalMinutes: 480,
    resolutionMinutes: 2880,
    escalationMinutes: 360,
    weekendCoverage: false,
    enabled: true,
  },
  {
    id: "sla-low",
    name: "Low priority",
    priority: "LOW",
    responseMinutes: 480,
    assignmentMinutes: 240,
    arrivalMinutes: 1440,
    resolutionMinutes: 5760,
    escalationMinutes: 720,
    weekendCoverage: false,
    enabled: true,
  },
];

function addMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

function minutesUntil(deadlineIso: string, from = new Date()): number {
  return Math.round((new Date(deadlineIso).getTime() - from.getTime()) / 60_000);
}

export function resolveSlaRule(
  priority: DispatchPriority | string,
  rules: SlaRule[] = DEFAULT_SLA_RULES,
): SlaRule {
  const normalized =
    priority === "URGENT" || priority === "EMERGENCY" ? "CRITICAL" : priority;
  return (
    rules.find((r) => r.enabled && r.priority === normalized) ??
    rules.find((r) => r.enabled && r.priority === "NORMAL") ??
    DEFAULT_SLA_RULES[2]
  );
}

export function evaluateSlaState(
  deadlineIso: string,
  from = new Date(),
  totalWindowMinutes: number,
): SlaState {
  const remaining = minutesUntil(deadlineIso, from);
  if (remaining < 0) return "BREACHED";
  if (remaining <= 15) return "AT_RISK";
  const usedPct = 1 - remaining / Math.max(1, totalWindowMinutes);
  if (usedPct >= 0.75) return "AT_RISK";
  if (usedPct >= 0.5) return "WARNING";
  return "OK";
}

export function buildSlaSnapshot(input: {
  createdAt: string;
  priority: DispatchPriority | string;
  rules?: SlaRule[];
  from?: Date;
}): SlaSnapshot {
  const rule = resolveSlaRule(input.priority, input.rules);
  const from = input.from ?? new Date();
  const responseDeadline = addMinutes(input.createdAt, rule.responseMinutes);
  const assignmentDeadline = addMinutes(input.createdAt, rule.assignmentMinutes);
  const arrivalDeadline = addMinutes(input.createdAt, rule.arrivalMinutes);
  const resolutionDeadline = addMinutes(input.createdAt, rule.resolutionMinutes);
  const escalationDeadline = addMinutes(input.createdAt, rule.escalationMinutes);

  return {
    ruleId: rule.id,
    responseDeadline,
    assignmentDeadline,
    arrivalDeadline,
    resolutionDeadline,
    escalationDeadline,
    responseState: evaluateSlaState(responseDeadline, from, rule.responseMinutes),
    resolutionState: evaluateSlaState(
      resolutionDeadline,
      from,
      rule.resolutionMinutes,
    ),
    minutesToResponse: minutesUntil(responseDeadline, from),
    minutesToResolution: minutesUntil(resolutionDeadline, from),
  };
}

export function slaWarningMessages(snapshot: SlaSnapshot): string[] {
  const msgs: string[] = [];
  if (snapshot.responseState === "WARNING") {
    msgs.push("50%+ of response SLA window used");
  }
  if (snapshot.responseState === "AT_RISK") {
    msgs.push(
      snapshot.minutesToResponse != null && snapshot.minutesToResponse <= 15
        ? "15 minutes remaining on response SLA"
        : "75%+ of response SLA window used",
    );
  }
  if (snapshot.responseState === "BREACHED") msgs.push("Response SLA breached");
  if (snapshot.resolutionState === "BREACHED") msgs.push("Resolution SLA breached");
  if (snapshot.resolutionState === "AT_RISK") msgs.push("Resolution SLA at risk");
  return msgs;
}
