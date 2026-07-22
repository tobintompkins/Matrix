/**
 * Patch 50C-2 — Security event lifecycle over AuditLog + SystemSecurityEventState.
 */

import { prisma } from "@/lib/db/prisma";
import type { AdminActor } from "@/lib/admin/auth";
import { writeAdminAudit } from "@/lib/admin/repository";
import { classifyAction } from "./taxonomy";
import { getSystemLogEvent } from "./query";

async function ensureSecurityState(actor: AdminActor, auditLogId: string) {
  const existing = await prisma.systemSecurityEventState.findUnique({
    where: { auditLogId },
  });
  if (existing) return existing;
  const audit = await prisma.auditLog.findFirst({
    where: { id: auditLogId, organizationId: actor.organizationId },
  });
  if (!audit) return null;
  const inferred = classifyAction(audit.action);
  if (
    !inferred.isSecurityCandidate &&
    audit.category !== "SECURITY" &&
    audit.category !== "AUTHORIZATION"
  ) {
    // Still allow explicit security workflow if category is SECURITY
    if (audit.category && audit.category !== "SECURITY") return null;
  }
  return prisma.systemSecurityEventState.create({
    data: {
      organizationId: actor.organizationId,
      auditLogId,
      status: "OPEN",
    },
  });
}

export async function acknowledgeSecurityEvent(input: {
  actor: AdminActor;
  id: string;
}) {
  const gate = await getSystemLogEvent(
    input.actor.organizationId,
    input.actor.role,
    input.id,
  );
  if (!gate.ok) return gate;
  const state = await ensureSecurityState(input.actor, input.id);
  if (!state) return { ok: false as const, error: "Not a security event." };
  const updated = await prisma.systemSecurityEventState.update({
    where: { id: state.id },
    data: {
      status: "ACKNOWLEDGED",
      acknowledgedAt: new Date(),
      acknowledgedByUserId: input.actor.userId,
    },
  });
  await writeAdminAudit({
    organizationId: input.actor.organizationId,
    actorId: input.actor.userId,
    action: "SECURITY_EVENT_ACKNOWLEDGED",
    entityType: "SystemSecurityEventState",
    entityId: updated.id,
    category: "SECURITY",
    severity: "NOTICE",
    outcome: "SUCCESS",
  });
  return { ok: true as const, status: updated.status };
}

export async function assignSecurityEvent(input: {
  actor: AdminActor;
  id: string;
  assignedUserId: string;
}) {
  if (!input.assignedUserId.trim()) {
    return { ok: false as const, error: "Assignee is required." };
  }
  const gate = await getSystemLogEvent(
    input.actor.organizationId,
    input.actor.role,
    input.id,
  );
  if (!gate.ok) return gate;
  const state = await ensureSecurityState(input.actor, input.id);
  if (!state) return { ok: false as const, error: "Not a security event." };
  const updated = await prisma.systemSecurityEventState.update({
    where: { id: state.id },
    data: {
      status: "ASSIGNED",
      assignedUserId: input.assignedUserId,
      assignedByUserId: input.actor.userId,
    },
  });
  await writeAdminAudit({
    organizationId: input.actor.organizationId,
    actorId: input.actor.userId,
    action: "SECURITY_EVENT_ASSIGNED",
    entityType: "SystemSecurityEventState",
    entityId: updated.id,
    category: "SECURITY",
    severity: "NOTICE",
    outcome: "SUCCESS",
    payload: { assignedUserId: input.assignedUserId },
  });
  return { ok: true as const, status: updated.status };
}

export async function investigateSecurityEvent(input: {
  actor: AdminActor;
  id: string;
}) {
  const gate = await getSystemLogEvent(
    input.actor.organizationId,
    input.actor.role,
    input.id,
  );
  if (!gate.ok) return gate;
  const state = await ensureSecurityState(input.actor, input.id);
  if (!state) return { ok: false as const, error: "Not a security event." };
  const updated = await prisma.systemSecurityEventState.update({
    where: { id: state.id },
    data: {
      status: "INVESTIGATING",
      investigatingAt: new Date(),
    },
  });
  await writeAdminAudit({
    organizationId: input.actor.organizationId,
    actorId: input.actor.userId,
    action: "SECURITY_EVENT_INVESTIGATION_STARTED",
    entityType: "SystemSecurityEventState",
    entityId: updated.id,
    category: "SECURITY",
    severity: "NOTICE",
    outcome: "SUCCESS",
  });
  return { ok: true as const, status: updated.status };
}

export async function resolveSecurityEvent(input: {
  actor: AdminActor;
  id: string;
  note: string;
  asFalsePositive?: boolean;
  dismiss?: boolean;
}) {
  if (!input.note.trim()) {
    return { ok: false as const, error: "Resolution note is required." };
  }
  const gate = await getSystemLogEvent(
    input.actor.organizationId,
    input.actor.role,
    input.id,
  );
  if (!gate.ok) return gate;
  const state = await ensureSecurityState(input.actor, input.id);
  if (!state) return { ok: false as const, error: "Not a security event." };
  const status = input.asFalsePositive
    ? "FALSE_POSITIVE"
    : input.dismiss
      ? "DISMISSED"
      : "RESOLVED";
  const updated = await prisma.systemSecurityEventState.update({
    where: { id: state.id },
    data: {
      status,
      resolvedAt: new Date(),
      resolvedByUserId: input.actor.userId,
      resolutionNote: input.note.trim().slice(0, 2000),
      dismissedAt: input.dismiss || input.asFalsePositive ? new Date() : null,
      dismissedByUserId:
        input.dismiss || input.asFalsePositive ? input.actor.userId : null,
      dismissalReason:
        input.dismiss || input.asFalsePositive
          ? input.note.trim().slice(0, 2000)
          : null,
    },
  });
  await writeAdminAudit({
    organizationId: input.actor.organizationId,
    actorId: input.actor.userId,
    action: input.asFalsePositive
      ? "SECURITY_EVENT_FALSE_POSITIVE"
      : input.dismiss
        ? "SECURITY_EVENT_DISMISSED"
        : "SECURITY_EVENT_RESOLVED",
    entityType: "SystemSecurityEventState",
    entityId: updated.id,
    category: "SECURITY",
    severity: "NOTICE",
    outcome: "SUCCESS",
  });
  return { ok: true as const, status: updated.status };
}
