/**
 * Patch 50A — Approval authorization helpers.
 */

import { hasMatrixPermission } from "@/lib/auth/permissions";
import type { MatrixPermission, MatrixRole } from "@/lib/auth/types";
import type { AdminActor } from "@/lib/admin/auth";
import { CLOSED_STATUSES, OPEN_STATUSES, type ApprovalStatus } from "./types";

export type ApprovalVisibilityRecord = {
  organizationId: string;
  requesterUserId: string;
  assignedApproverUserId: string | null;
  status: string;
};

export function canViewApproval(
  actor: AdminActor,
  record: ApprovalVisibilityRecord,
): boolean {
  if (record.organizationId !== actor.organizationId) return false;
  if (hasMatrixPermission(actor.role, "VIEW_ALL_APPROVALS")) return true;
  if (record.requesterUserId === actor.userId) return true;
  if (
    hasMatrixPermission(actor.role, "VIEW_ASSIGNED_APPROVALS") &&
    record.assignedApproverUserId === actor.userId
  ) {
    return true;
  }
  return hasMatrixPermission(actor.role, "VIEW_APPROVAL_CENTER") &&
    record.requesterUserId === actor.userId;
}

export function canActOnStep(
  actor: AdminActor,
  input: {
    assignedUserId: string | null;
    requiredPermission: string | null;
    status: string;
  },
): boolean {
  if (input.status !== "ACTIVE") return false;
  if (input.assignedUserId && input.assignedUserId !== actor.userId) {
    // Assigned reviewer must match unless admin with assign/approve all
    if (!hasMatrixPermission(actor.role, "VIEW_ALL_APPROVALS")) return false;
  }
  if (input.requiredPermission) {
    return hasMatrixPermission(
      actor.role,
      input.requiredPermission as MatrixPermission,
    );
  }
  return hasMatrixPermission(actor.role, "APPROVE_REQUEST");
}

export function requirePermission(
  actor: AdminActor,
  permission: MatrixPermission,
): void {
  if (!hasMatrixPermission(actor.role, permission)) {
    throw new Error(`Missing permission: ${permission}`);
  }
}

export function isOpenStatus(status: string): boolean {
  return (OPEN_STATUSES as string[]).includes(status);
}

export function isClosedStatus(status: string): boolean {
  return (CLOSED_STATUSES as string[]).includes(status);
}

export function roleDisplay(role: MatrixRole): string {
  return role.replace(/_/g, " ");
}

export function assertSameOrganization(
  actor: AdminActor,
  organizationId: string,
): void {
  if (actor.organizationId !== organizationId) {
    throw new Error("Organization scope mismatch.");
  }
}
