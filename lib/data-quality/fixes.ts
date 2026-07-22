/**
 * Patch 50C-1 — Safe automated fixes (preview + execute). High-risk blocked.
 */

import type { AdminActor } from "@/lib/admin/auth";
import { writeAdminAudit } from "@/lib/admin/repository";
import { updateCustomer } from "@/lib/crm/repository";
import { prisma } from "@/lib/db/prisma";
import { normalizeEmail } from "./score";

const SAFE_FIXES = new Set([
  "TRIM_WHITESPACE_CUSTOMER_NAME",
  "NORMALIZE_EMAIL_CASING_CONTACT",
]);

export async function previewDataQualityFix(input: {
  actor: AdminActor;
  issueId: string;
  fixCode: string;
}) {
  if (!SAFE_FIXES.has(input.fixCode)) {
    return {
      ok: false as const,
      error:
        "This fix is not registered as a safe automated fix. Use manual cleanup or merge.",
    };
  }
  const issue = await prisma.dataQualityIssue.findFirst({
    where: { id: input.issueId, organizationId: input.actor.organizationId },
  });
  if (!issue) return { ok: false as const, error: "Issue not found." };

  if (input.fixCode === "TRIM_WHITESPACE_CUSTOMER_NAME") {
    const current = issue.currentValue ?? "";
    const next = current.trim();
    return {
      ok: true as const,
      preview: {
        fixCode: input.fixCode,
        entityType: issue.entityType,
        entityId: issue.entityId,
        fieldName: "name",
        before: current,
        after: next,
        mutates: current !== next,
      },
    };
  }

  return {
    ok: true as const,
    preview: {
      fixCode: input.fixCode,
      entityType: issue.entityType,
      entityId: issue.entityId,
      fieldName: issue.fieldName,
      before: issue.currentValue,
      after: issue.expectedValue,
      mutates: false,
    },
  };
}

export async function executeDataQualityFix(input: {
  actor: AdminActor;
  issueId: string;
  fixCode: string;
  confirm: boolean;
}) {
  if (!input.confirm) {
    return { ok: false as const, error: "Confirmation is required." };
  }
  const preview = await previewDataQualityFix(input);
  if (!preview.ok) return preview;
  if (!preview.preview.mutates) {
    return { ok: false as const, error: "No safe change to apply." };
  }

  await writeAdminAudit({
    organizationId: input.actor.organizationId,
    actorId: input.actor.userId,
    action: "DATA_QUALITY_FIX_PREVIEWED",
    entityType: "DataQualityIssue",
    entityId: input.issueId,
    payload: preview.preview,
  });

  if (input.fixCode === "TRIM_WHITESPACE_CUSTOMER_NAME") {
    const result = updateCustomer(preview.preview.entityId, {
      name: String(preview.preview.after ?? "").trim(),
    });
    if (!result.ok) {
      return {
        ok: false as const,
        error: result.error ?? "Customer update failed.",
      };
    }
  } else {
    return { ok: false as const, error: "Unsupported safe fix." };
  }

  await prisma.dataQualityIssue.update({
    where: { id: input.issueId },
    data: {
      status: "RESOLVED",
      resolvedAt: new Date(),
      resolvedByUserId: input.actor.userId,
      resolutionMethod: "AUTOMATED_FIX",
      resolutionNote: `Applied ${input.fixCode}`,
    },
  });

  await writeAdminAudit({
    organizationId: input.actor.organizationId,
    actorId: input.actor.userId,
    action: "DATA_QUALITY_FIX_EXECUTED",
    entityType: "DataQualityIssue",
    entityId: input.issueId,
    payload: { fixCode: input.fixCode },
  });

  return { ok: true as const, preview: preview.preview };
}

/** Exported for tests — email normalize is safe formatting only. */
export function safeNormalizeEmailPreview(value: string) {
  return normalizeEmail(value);
}
