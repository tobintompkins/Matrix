/**
 * Patch 51B — PM schedule-change requests (Approval Center when available, else internal review).
 */

import { prisma } from "@/lib/db/prisma";
import { writeAdminAudit } from "@/lib/admin/repository";
import { createEventNotification, pushNotification } from "@/lib/notifications";
import type { CustomerMembership } from "./types";
import {
  assertPrinterAccess,
  requestPmScheduling,
  setActivePortalMembership,
} from "./repository";
import { getPortalSettings } from "./config";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import { portalRecipientIds } from "./notification-targets";

export async function requestPortalPmChange(input: {
  membership: CustomerMembership;
  machineId: string;
  pmId?: string | null;
  requestedDate?: string | null;
  reason: string;
  organizationId?: string;
}) {
  setActivePortalMembership(input.membership.id);
  const settings = await getPortalSettings(
    input.organizationId ?? DEFAULT_ORG_ID,
  );
  if (!settings.allowCustomerPmChangeRequests) {
    return { ok: false as const, error: "PM change requests are disabled." };
  }
  if (!input.membership.canViewPm) {
    return { ok: false as const, error: "PM access is not permitted." };
  }
  if (!input.reason.trim()) {
    return { ok: false as const, error: "A reason is required." };
  }

  const access = assertPrinterAccess(input.machineId);
  if (!access.ok) return { ok: false as const, error: access.error };

  // Never mutate the live PM schedule from the portal — create a review request.
  const fallback = requestPmScheduling(
    input.machineId,
    [
      input.reason.trim(),
      input.requestedDate ? `Preferred date: ${input.requestedDate}` : null,
    ]
      .filter(Boolean)
      .join(" | "),
  );

  const change = await prisma.customerChangeRequest.create({
    data: {
      organizationId: input.organizationId ?? DEFAULT_ORG_ID,
      customerId: input.membership.customerId,
      membershipId: input.membership.id,
      requestType: "PM_SCHEDULE_CHANGE",
      payloadJson: JSON.stringify({
        machineId: input.machineId,
        pmId: input.pmId ?? null,
        requestedDate: input.requestedDate ?? null,
        reason: input.reason.trim(),
        fallbackAudit: fallback,
      }),
      status: "PENDING",
    },
  });

  let approvalId: string | null = null;
  try {
    const { submitApprovalFromModule } = await import("@/lib/approvals");
    const { hasMatrixPermission } = await import("@/lib/auth/permissions");
    // Use system-style actor with CREATE permission via admin fallback path:
    // If Approval Center is available, create GENERAL/PM change approval as org admin service.
    if (hasMatrixPermission("ADMIN", "CREATE_APPROVAL_REQUEST")) {
      const approval = await submitApprovalFromModule(
        {
          role: "ADMIN",
          displayName: input.membership.displayName,
          userId: input.membership.clerkUserId,
          organizationId: input.organizationId ?? DEFAULT_ORG_ID,
          regionId: null,
          authenticated: true,
        },
        {
          title: `PM schedule change — ${input.machineId}`,
          approvalType: "PM_SCHEDULE_CHANGE",
          sourceModule: "portal",
          sourceRecordId: change.id,
          machineId: input.machineId,
          priority: "NORMAL",
          description: input.reason.trim(),
          businessJustification: `Customer portal schedule-change request. Preferred date: ${input.requestedDate ?? "flexible"}.`,
        },
      );
      approvalId = approval.id;
      await prisma.customerChangeRequest.update({
        where: { id: change.id },
        data: {
          payloadJson: JSON.stringify({
            ...JSON.parse(change.payloadJson),
            approvalRequestId: approvalId,
          }),
        },
      });
    }
  } catch {
    /* Approval Center optional — internal review row already created */
  }

  await writeAdminAudit({
    organizationId: input.organizationId ?? DEFAULT_ORG_ID,
    actorId: input.membership.clerkUserId,
    action: "PORTAL_PM_CHANGE_REQUESTED",
    entityType: "CustomerChangeRequest",
    entityId: change.id,
    payload: {
      machineId: input.machineId,
      approvalId,
      customerId: input.membership.customerId,
    },
  });

  pushNotification(
    createEventNotification({
      type: "SCHEDULE_CHANGED",
      title: "Portal PM change requested",
      message: `${input.membership.displayName} requested a PM schedule change for ${input.machineId}.`,
      userIds: ["Matrix User", ...portalRecipientIds(input.membership)],
      priority: "NORMAL",
      relatedRecordType: "pm_change_request",
      relatedRecordId: change.id,
    }),
  );

  return {
    ok: true as const,
    requestId: change.id,
    approvalId,
    message:
      "Your schedule-change request was submitted for review. The current PM schedule was not changed.",
  };
}
