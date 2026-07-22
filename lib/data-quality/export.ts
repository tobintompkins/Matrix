/**
 * Patch 50C-1 — Safe CSV exports (allowlisted fields).
 */

import type { AdminActor } from "@/lib/admin/auth";
import { writeAdminAudit } from "@/lib/admin/repository";
import { toCsv } from "@/lib/admin/completion/csv";
import { prisma } from "@/lib/db/prisma";
import { getDataQualitySummary } from "./summary";
import { listDataQualityRules } from "./rules";
import { listMergeHistory } from "./merge";

const OPEN = ["OPEN", "ASSIGNED", "IN_REVIEW", "FIX_PENDING", "REOPENED"];

export async function exportDataQuality(
  actor: AdminActor,
  kind: string,
): Promise<
  { ok: true; filename: string; csv: string } | { ok: false; error: string }
> {
  const orgId = actor.organizationId;
  const filename = `data-quality-${kind}.csv`;
  let csv = "";

  if (kind === "summary") {
    const summary = await getDataQualitySummary(actor);
    if (!summary.ok || !summary.enabled || !("cards" in summary) || !summary.cards) {
      return { ok: false, error: "Summary unavailable." };
    }
    const cards = summary.cards;
    csv = toCsv(
      ["metric", "value"],
      [
        ["Overall Score", cards.overallDataHealthScore],
        ["Open Issues", cards.openDataIssues],
        ["Critical", cards.criticalIssues],
        ["Duplicates", cards.duplicateCandidates],
        ["Missing", cards.missingRequiredFields],
        ["Invalid", cards.invalidRecords],
        ["Orphaned", cards.orphanedRecords],
      ],
    );
  } else if (
    kind === "issues" ||
    kind === "critical" ||
    kind === "duplicates" ||
    kind === "missing" ||
    kind === "orphaned" ||
    kind === "invalid"
  ) {
    const where: Record<string, unknown> = {
      organizationId: orgId,
      status: { in: OPEN },
    };
    if (kind === "critical") where.severity = "CRITICAL";
    if (kind === "duplicates")
      where.issueType = { in: ["DUPLICATE", "POSSIBLE_MERGE"] };
    if (kind === "missing") where.issueType = "MISSING_REQUIRED_VALUE";
    if (kind === "orphaned")
      where.issueType = { in: ["ORPHANED_RECORD", "BROKEN_RELATIONSHIP"] };
    if (kind === "invalid")
      where.issueType = { in: ["INVALID_VALUE", "FORMAT_ERROR", "OUTLIER"] };
    const rows = await prisma.dataQualityIssue.findMany({
      where,
      take: 5000,
      orderBy: { lastDetectedAt: "desc" },
    });
    csv = toCsv(
      [
        "id",
        "severity",
        "status",
        "module",
        "issueType",
        "title",
        "entityType",
        "entityId",
        "firstDetectedAt",
        "lastDetectedAt",
      ],
      rows.map((r) => [
        r.id,
        r.severity,
        r.status,
        r.module,
        r.issueType,
        r.title,
        r.entityType,
        r.entityId,
        r.firstDetectedAt.toISOString(),
        r.lastDetectedAt.toISOString(),
      ]),
    );
  } else if (kind === "scans") {
    const rows = await prisma.dataQualityScan.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    csv = toCsv(
      [
        "id",
        "scanType",
        "status",
        "issuesFound",
        "criticalIssuesFound",
        "startedAt",
        "completedAt",
      ],
      rows.map((r) => [
        r.id,
        r.scanType,
        r.status,
        r.issuesFound,
        r.criticalIssuesFound,
        r.startedAt?.toISOString() ?? "",
        r.completedAt?.toISOString() ?? "",
      ]),
    );
  } else if (kind === "rules") {
    const rows = await listDataQualityRules(orgId);
    csv = toCsv(
      ["code", "name", "module", "severity", "isActive", "isSystemRule"],
      rows.map((r) => [
        r.code,
        r.name,
        r.module,
        r.severity,
        r.isActive ? "true" : "false",
        r.isSystemRule ? "true" : "false",
      ]),
    );
  } else if (kind === "merges") {
    const rows = await listMergeHistory(orgId, 500);
    csv = toCsv(
      [
        "id",
        "entityType",
        "masterRecordId",
        "mergedRecordId",
        "reason",
        "performedByUserId",
        "performedAt",
        "rollbackStatus",
      ],
      rows.map((r) => [
        r.id,
        r.entityType,
        r.masterRecordId,
        r.mergedRecordId,
        r.reason,
        r.performedByUserId,
        r.performedAt,
        r.rollbackStatus,
      ]),
    );
  } else {
    return { ok: false, error: "Unknown export kind." };
  }

  await writeAdminAudit({
    organizationId: orgId,
    actorId: actor.userId,
    action: "DATA_QUALITY_EXPORTED",
    entityType: "DataQualityExport",
    entityId: kind,
  });

  return { ok: true, filename, csv };
}
