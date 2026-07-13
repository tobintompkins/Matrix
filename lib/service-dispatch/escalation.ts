import type { DispatchPriority, EscalationLevel, SlaSnapshot } from "./types";

export type EscalationTrigger =
  | "CRITICAL_UNASSIGNED"
  | "HIGH_NOT_ACCEPTED"
  | "MISSED_ARRIVAL"
  | "DIAGNOSIS_TOO_LONG"
  | "PARTS_OVERDUE"
  | "REOPENED"
  | "LOW_SATISFACTION"
  | "REPEAT_FAILURE"
  | "SLA_AT_RISK"
  | "SLA_BREACHED";

export type EscalationAction =
  | "NOTIFY_DISPATCHER"
  | "NOTIFY_MANAGER"
  | "NOTIFY_TECHNICIAN"
  | "REASSIGN"
  | "INCREASE_LEVEL"
  | "MANAGEMENT_ALERT"
  | "AUDIT_LOG";

export type EscalationEvent = {
  trigger: EscalationTrigger;
  actions: EscalationAction[];
  message: string;
  newLevel: EscalationLevel;
};

export function evaluateEscalations(input: {
  priority: DispatchPriority | string;
  status: string;
  assignedTechnician: string;
  createdAt: string;
  acceptedAt: string | null;
  scheduledEnd: string | null;
  statusEnteredAt: string | null;
  partsExpectedAt: string | null;
  satisfactionRating: number | null;
  reopened: boolean;
  repeatFailure: boolean;
  sla: SlaSnapshot;
  escalationLevel: EscalationLevel;
  from?: Date;
}): EscalationEvent[] {
  const now = input.from ?? new Date();
  const events: EscalationEvent[] = [];
  const ageMin = (now.getTime() - new Date(input.createdAt).getTime()) / 60_000;
  const priority =
    input.priority === "URGENT" || input.priority === "EMERGENCY"
      ? "CRITICAL"
      : input.priority;

  const bump = (n: number): EscalationLevel =>
    Math.min(4, Math.max(input.escalationLevel, n)) as EscalationLevel;

  if (
    priority === "CRITICAL" &&
    !input.assignedTechnician &&
    ["NEW", "AWAITING_REVIEW", "UNASSIGNED"].includes(input.status) &&
    ageMin >= 15
  ) {
    events.push({
      trigger: "CRITICAL_UNASSIGNED",
      actions: ["NOTIFY_DISPATCHER", "NOTIFY_MANAGER", "INCREASE_LEVEL", "AUDIT_LOG"],
      message: "Critical ticket unassigned for 15+ minutes",
      newLevel: bump(2),
    });
  }

  if (
    priority === "HIGH" &&
    input.assignedTechnician &&
    !input.acceptedAt &&
    ["ASSIGNED", "TECHNICIAN_NOTIFIED"].includes(input.status) &&
    ageMin >= 30
  ) {
    events.push({
      trigger: "HIGH_NOT_ACCEPTED",
      actions: ["NOTIFY_DISPATCHER", "NOTIFY_TECHNICIAN", "INCREASE_LEVEL", "AUDIT_LOG"],
      message: "High-priority ticket not accepted within 30 minutes",
      newLevel: bump(1),
    });
  }

  if (
    input.scheduledEnd &&
    new Date(input.scheduledEnd) < now &&
    !["ON_SITE", "DIAGNOSIS", "DIAGNOSING", "REPAIR_IN_PROGRESS", "TESTING", "RESOLVED", "CLOSED"].includes(
      input.status,
    )
  ) {
    events.push({
      trigger: "MISSED_ARRIVAL",
      actions: ["NOTIFY_DISPATCHER", "NOTIFY_MANAGER", "AUDIT_LOG"],
      message: "Technician has not arrived by the scheduled window",
      newLevel: bump(2),
    });
  }

  if (
    ["DIAGNOSIS", "DIAGNOSING"].includes(input.status) &&
    input.statusEnteredAt &&
    (now.getTime() - new Date(input.statusEnteredAt).getTime()) / 60_000 >= 180
  ) {
    events.push({
      trigger: "DIAGNOSIS_TOO_LONG",
      actions: ["NOTIFY_MANAGER", "INCREASE_LEVEL", "AUDIT_LOG"],
      message: "Ticket remains in Diagnosis too long",
      newLevel: bump(1),
    });
  }

  if (
    input.status === "WAITING_FOR_PARTS" &&
    input.partsExpectedAt &&
    new Date(input.partsExpectedAt) < now
  ) {
    events.push({
      trigger: "PARTS_OVERDUE",
      actions: ["NOTIFY_DISPATCHER", "NOTIFY_TECHNICIAN", "AUDIT_LOG"],
      message: "Ticket waits for parts beyond expected arrival",
      newLevel: bump(1),
    });
  }

  if (input.reopened) {
    events.push({
      trigger: "REOPENED",
      actions: ["NOTIFY_MANAGER", "MANAGEMENT_ALERT", "AUDIT_LOG"],
      message: "Resolved ticket reopened",
      newLevel: bump(2),
    });
  }

  if (input.satisfactionRating != null && input.satisfactionRating <= 2) {
    events.push({
      trigger: "LOW_SATISFACTION",
      actions: ["NOTIFY_MANAGER", "MANAGEMENT_ALERT", "AUDIT_LOG"],
      message: "Customer rating is 2 stars or lower",
      newLevel: bump(2),
    });
  }

  if (input.repeatFailure) {
    events.push({
      trigger: "REPEAT_FAILURE",
      actions: ["NOTIFY_MANAGER", "MANAGEMENT_ALERT", "AUDIT_LOG"],
      message: "Same printer has repeated failures",
      newLevel: bump(2),
    });
  }

  if (input.sla.responseState === "AT_RISK" || input.sla.resolutionState === "AT_RISK") {
    events.push({
      trigger: "SLA_AT_RISK",
      actions: ["NOTIFY_DISPATCHER", "NOTIFY_TECHNICIAN", "AUDIT_LOG"],
      message: "SLA is at risk",
      newLevel: bump(1),
    });
  }

  if (input.sla.responseState === "BREACHED" || input.sla.resolutionState === "BREACHED") {
    events.push({
      trigger: "SLA_BREACHED",
      actions: [
        "NOTIFY_DISPATCHER",
        "NOTIFY_MANAGER",
        "MANAGEMENT_ALERT",
        "INCREASE_LEVEL",
        "AUDIT_LOG",
      ],
      message: "SLA breached",
      newLevel: bump(3),
    });
  }

  return events;
}
