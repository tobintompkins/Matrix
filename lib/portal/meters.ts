/**
 * Patch 51B — Customer meter submission via existing PM intelligence meter system.
 */

import {
  enterMeterCount,
  listMeterTableRows,
} from "@/lib/pm-intelligence";
import { writeAdminAudit } from "@/lib/admin/repository";
import {
  createEventNotification,
  pushNotification,
} from "@/lib/notifications";
import type { CustomerMembership } from "./types";
import {
  assertPrinterAccess,
  getAuthorizedPrinterIds,
  setActivePortalMembership,
} from "./repository";
import { getPortalSettings } from "./config";
import { portalRecipientIds } from "./notification-targets";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";

function activate(membership: CustomerMembership) {
  setActivePortalMembership(membership.id);
}

export function listPortalMeterDashboard(membership: CustomerMembership) {
  activate(membership);
  const allowed = new Set(getAuthorizedPrinterIds(membership));
  return listMeterTableRows()
    .filter((r) => allowed.has(r.printerId))
    .map((r) => ({
      machineId: r.printerId,
      machineName: r.machineName,
      locationName: r.siteName,
      lastMeter: r.currentMeter,
      lastSubmittedAt: r.lastCountDate,
      nextDueLabel: r.pmStatus,
      status: r.pmStatus,
    }));
}

export async function submitPortalMeterReading(input: {
  membership: CustomerMembership;
  machineId: string;
  meterCount: number;
  readingDate?: string;
  note?: string;
  photoUrl?: string | null;
  overrideReason?: string;
  organizationId?: string;
}) {
  activate(input.membership);
  const settings = await getPortalSettings(
    input.organizationId ?? DEFAULT_ORG_ID,
  );
  if (!settings.allowCustomerMeterSubmissions) {
    return { ok: false as const, error: "Meter submissions are disabled." };
  }
  if (!input.membership.canViewMeters) {
    return { ok: false as const, error: "Meter access is not permitted." };
  }

  const access = assertPrinterAccess(input.machineId);
  if (!access.ok) return { ok: false as const, error: access.error };

  const readingDate = input.readingDate ?? new Date().toISOString();
  if (new Date(readingDate).getTime() > Date.now() + 60_000) {
    return { ok: false as const, error: "Future reading dates are not allowed." };
  }

  const result = enterMeterCount({
    printerId: input.machineId,
    meterCount: input.meterCount,
    recordedAt: readingDate,
    notes: input.note ?? "",
    source: "Customer Submission",
    enteredBy: input.membership.displayName,
    photoUrl: input.photoUrl ?? null,
    overrideReason: input.overrideReason,
  });

  if (!result.ok) {
    return {
      ok: false as const,
      error: result.error,
      requiresOverride: result.requiresOverride,
      warnings: result.warnings,
    };
  }

  await writeAdminAudit({
    organizationId: input.organizationId ?? DEFAULT_ORG_ID,
    actorId: input.membership.clerkUserId,
    action: "PORTAL_METER_SUBMITTED",
    entityType: "MeterReading",
    entityId: result.reading.id,
    payload: {
      machineId: input.machineId,
      meterCount: input.meterCount,
      customerId: input.membership.customerId,
      suspectedReset: result.reading.suspectedReset,
      unusualIncrease: result.reading.unusualIncrease,
    },
  });

  pushNotification(
    createEventNotification({
      type: "COPY_COUNT_UPDATED",
      title: `Portal meter submitted — ${input.machineId}`,
      message: `${input.membership.displayName} submitted meter ${input.meterCount.toLocaleString()}.`,
      userIds: ["Matrix User", ...portalRecipientIds(input.membership)],
      priority:
        result.reading.unusualIncrease || result.reading.suspectedReset
          ? "HIGH"
          : "NORMAL",
      relatedRecordType: "meter_reading",
      relatedRecordId: result.reading.id,
    }),
  );

  return {
    ok: true as const,
    reading: {
      id: result.reading.id,
      machineId: result.reading.printerId,
      meterCount: result.reading.meterCount,
      recordedAt: result.reading.recordedAt,
      source: result.reading.source,
      warnings: result.warnings,
      underReview:
        result.reading.suspectedReset || result.reading.unusualIncrease,
    },
  };
}

export function listPortalMeterHistory(membership: CustomerMembership) {
  return listPortalMeterDashboard(membership);
}
