/**
 * Patch 50C-1 — Controlled merge for supported entities (transactional archive of duplicate).
 * Customer merges create an Approval Center request (GENERAL_REQUEST) before archival.
 */

import type { AdminActor } from "@/lib/admin/auth";
import { writeAdminAudit } from "@/lib/admin/repository";
import { archiveCustomer } from "@/lib/admin/data/customers";
import { archiveMachine } from "@/lib/admin/data/machines";
import { archivePart } from "@/lib/admin/data/inventory";
import { getCustomer } from "@/lib/crm/repository";
import { prisma } from "@/lib/db/prisma";
import { listAdminMachines } from "@/lib/admin/data/machines";
import { listCatalog } from "@/lib/inventory/enterprise-repository";
import { submitApprovalFromModule } from "@/lib/approvals/service";

const SUPPORTED = new Set(["Customer", "Machine", "Part"]);

function adminActorForArchive(actor: AdminActor) {
  return {
    userId: actor.userId,
    displayName: actor.displayName,
    organizationId: actor.organizationId,
  };
}

export async function previewDataQualityMerge(input: {
  actor: AdminActor;
  entityType: string;
  masterRecordId: string;
  duplicateRecordId: string;
}) {
  if (!SUPPORTED.has(input.entityType)) {
    return { ok: false as const, error: "Entity type is not merge-supported." };
  }
  if (input.masterRecordId === input.duplicateRecordId) {
    return { ok: false as const, error: "Master and duplicate must differ." };
  }

  if (input.entityType === "Customer") {
    const master = getCustomer(input.masterRecordId);
    const dup = getCustomer(input.duplicateRecordId);
    if (!master || !dup) {
      return { ok: false as const, error: "Customer record not found." };
    }
    return {
      ok: true as const,
      preview: {
        entityType: "Customer",
        master: {
          id: master.id,
          name: master.name,
          customerNumber: master.customerNumber,
        },
        duplicate: {
          id: dup.id,
          name: dup.name,
          customerNumber: dup.customerNumber,
        },
        fieldSelections: {
          name: master.name,
          customerNumber: master.customerNumber,
        },
        relationships: {
          note: "Locations/contacts/machines remain on master; duplicate will be archived.",
        },
        requiresApproval: true,
        blocked: false,
      },
    };
  }

  if (input.entityType === "Machine") {
    const machines = listAdminMachines({
      recordState: "ACTIVE",
      pageSize: 5000,
    }).items;
    const master = machines.find((m) => m.machineId === input.masterRecordId);
    const dup = machines.find((m) => m.machineId === input.duplicateRecordId);
    if (!master || !dup) {
      return { ok: false as const, error: "Machine record not found." };
    }
    return {
      ok: true as const,
      preview: {
        entityType: "Machine",
        master: {
          id: master.machineId,
          serial: master.serialNumber,
          customer: master.customerName,
        },
        duplicate: {
          id: dup.machineId,
          serial: dup.serialNumber,
          customer: dup.customerName,
        },
        fieldSelections: {
          serialNumber: master.serialNumber,
          customerName: master.customerName,
        },
        relationships: {
          note: "Service/PM/meter history should be reviewed after archive of duplicate.",
        },
        requiresApproval: false,
        blocked: false,
      },
    };
  }

  const parts = listCatalog("", 1, 5000).items;
  const master = parts.find((p) => p.id === input.masterRecordId);
  const dup = parts.find((p) => p.id === input.duplicateRecordId);
  if (!master || !dup) {
    return { ok: false as const, error: "Part record not found." };
  }
  return {
    ok: true as const,
    preview: {
      entityType: "Part",
      master: { id: master.id, partNumber: master.partNumber },
      duplicate: { id: dup.id, partNumber: dup.partNumber },
      fieldSelections: { partNumber: master.partNumber },
      relationships: {
        note: "Inventory balances on duplicate must be reviewed manually; duplicate part is archived.",
      },
      requiresApproval: false,
      blocked: false,
    },
  };
}

export async function executeDataQualityMerge(input: {
  actor: AdminActor;
  entityType: string;
  masterRecordId: string;
  duplicateRecordId: string;
  reason: string;
  confirm: boolean;
}) {
  if (!input.confirm) {
    return { ok: false as const, error: "Confirmation is required." };
  }
  if (!input.reason.trim() || input.reason.trim().length < 5) {
    return { ok: false as const, error: "Merge reason is required." };
  }
  const preview = await previewDataQualityMerge(input);
  if (!preview.ok) return preview;

  await writeAdminAudit({
    organizationId: input.actor.organizationId,
    actorId: input.actor.userId,
    action: "DATA_QUALITY_MERGE_PREVIEWED",
    entityType: input.entityType,
    entityId: input.masterRecordId,
    payload: preview.preview,
  });

  let approvalRequestId: string | null = null;
  try {
    if (input.entityType === "Customer") {
      try {
        const approval = await submitApprovalFromModule(input.actor, {
          title: `Customer merge: ${input.duplicateRecordId} → ${input.masterRecordId}`,
          description: input.reason.trim(),
          businessJustification: input.reason.trim(),
          approvalType: "GENERAL_REQUEST",
          sourceModule: "data_quality",
          sourceRecordId: input.masterRecordId,
          customerId: input.masterRecordId,
          priority: "HIGH",
          submit: true,
        });
        approvalRequestId = approval.id;
      } catch (e) {
        return {
          ok: false as const,
          error: `Customer merge requires Approval Center: ${
            e instanceof Error ? e.message : "approval failed"
          }`,
        };
      }
    }

    const actor = adminActorForArchive(input.actor);
    if (input.entityType === "Customer") {
      const result = archiveCustomer(
        input.duplicateRecordId,
        actor,
        `DUPLICATE_RECORD: ${input.reason.trim()}`,
      );
      if (!result.ok) return { ok: false as const, error: result.error };
    } else if (input.entityType === "Machine") {
      const result = archiveMachine(
        input.duplicateRecordId,
        actor,
        `DUPLICATE_RECORD: ${input.reason.trim()}`,
      );
      if (!result.ok) return { ok: false as const, error: result.error };
    } else {
      const result = archivePart(
        input.duplicateRecordId,
        actor,
        `DUPLICATE_RECORD: ${input.reason.trim()}`,
      );
      if (!result.ok) return { ok: false as const, error: result.error };
    }

    const history = await prisma.dataMergeHistory.create({
      data: {
        organizationId: input.actor.organizationId,
        entityType: input.entityType,
        masterRecordId: input.masterRecordId,
        mergedRecordId: input.duplicateRecordId,
        fieldSelectionsJson: JSON.stringify(preview.preview.fieldSelections),
        relationshipSummaryJson: JSON.stringify({
          ...preview.preview.relationships,
          approvalRequestId,
        }),
        performedByUserId: input.actor.userId,
        reason: input.reason.trim().slice(0, 2000),
        performedAt: new Date(),
        rollbackStatus: "NOT_SUPPORTED",
      },
    });

    await prisma.dataQualityIssue.updateMany({
      where: {
        organizationId: input.actor.organizationId,
        entityId: { in: [input.masterRecordId, input.duplicateRecordId] },
        issueType: { in: ["DUPLICATE", "POSSIBLE_MERGE"] },
        status: { in: ["OPEN", "ASSIGNED", "IN_REVIEW", "REOPENED"] },
      },
      data: {
        status: "RESOLVED",
        resolvedAt: new Date(),
        resolvedByUserId: input.actor.userId,
        resolutionMethod: "MERGE",
        resolutionNote: `Merged into ${input.masterRecordId}`,
      },
    });

    await writeAdminAudit({
      organizationId: input.actor.organizationId,
      actorId: input.actor.userId,
      action: "DATA_QUALITY_MERGE_COMPLETED",
      entityType: "DataMergeHistory",
      entityId: history.id,
      payload: { approvalRequestId },
    });

    return {
      ok: true as const,
      mergeId: history.id,
      approvalRequestId,
      preview: preview.preview,
    };
  } catch (e) {
    await writeAdminAudit({
      organizationId: input.actor.organizationId,
      actorId: input.actor.userId,
      action: "DATA_QUALITY_MERGE_FAILED",
      entityType: input.entityType,
      entityId: input.masterRecordId,
      payload: { error: e instanceof Error ? e.message : "failed" },
    });
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Merge failed.",
    };
  }
}

export async function listMergeHistory(organizationId: string, limit = 50) {
  const rows = await prisma.dataMergeHistory.findMany({
    where: { organizationId },
    orderBy: { performedAt: "desc" },
    take: Math.min(100, Math.max(1, limit)),
  });
  return rows.map((r) => ({
    id: r.id,
    entityType: r.entityType,
    masterRecordId: r.masterRecordId,
    mergedRecordId: r.mergedRecordId,
    reason: r.reason,
    performedByUserId: r.performedByUserId,
    performedAt: r.performedAt.toISOString(),
    rollbackStatus: r.rollbackStatus,
  }));
}
