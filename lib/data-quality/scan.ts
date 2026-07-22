/**
 * Patch 50C-1 — Scan + issue lifecycle (scans never mutate source records).
 */

import { prisma } from "@/lib/db/prisma";
import type { AdminActor } from "@/lib/admin/auth";
import { writeAdminAudit } from "@/lib/admin/repository";
import { DATA_QUALITY_CALC_VERSION } from "./score";
import { getDataQualitySettings } from "./settings";
import { ensureSystemRulesSeeded } from "./rules";
import { detectDataQualityFindings } from "./detect";

export async function runDataQualityScan(input: {
  actor: AdminActor;
  scanType?: string;
  modules?: string[];
}) {
  const settings = await getDataQualitySettings(input.actor.organizationId);
  if (!settings.enabled) {
    return { ok: false as const, error: "Data Quality Center is disabled." };
  }
  await ensureSystemRulesSeeded(input.actor.organizationId);

  const running = await prisma.dataQualityScan.findFirst({
    where: {
      organizationId: input.actor.organizationId,
      status: "RUNNING",
      scanType: "FULL",
    },
  });
  if (running && (input.scanType ?? "FULL") === "FULL") {
    return {
      ok: false as const,
      error: "A full scan is already running.",
    };
  }

  const scan = await prisma.dataQualityScan.create({
    data: {
      organizationId: input.actor.organizationId,
      scanType: input.scanType ?? "MANUAL",
      status: "RUNNING",
      modulesJson: JSON.stringify(input.modules ?? ["ALL"]),
      requestedByUserId: input.actor.userId,
      startedAt: new Date(),
      calculationVersion: DATA_QUALITY_CALC_VERSION,
    },
  });

  await writeAdminAudit({
    organizationId: input.actor.organizationId,
    actorId: input.actor.userId,
    action: "DATA_QUALITY_SCAN_STARTED",
    entityType: "DataQualityScan",
    entityId: scan.id,
  });

  try {
    const findings = await detectDataQualityFindings(settings);
    const activeRules = await prisma.dataQualityRule.findMany({
      where: { organizationId: input.actor.organizationId, isActive: true },
    });
    const activeCodes = new Set(activeRules.map((r) => r.code));
    const filtered = findings.filter((f) => activeCodes.has(f.ruleCode));

    let created = 0;
    let updated = 0;
    let critical = 0;
    const seenKeys = new Set<string>();

    for (const f of filtered) {
      seenKeys.add(f.issueKey);
      if (f.severity === "CRITICAL") critical += 1;
      const rule = activeRules.find((r) => r.code === f.ruleCode);
      const existing = await prisma.dataQualityIssue.findFirst({
        where: {
          organizationId: input.actor.organizationId,
          issueKey: f.issueKey,
          status: {
            in: ["OPEN", "ASSIGNED", "IN_REVIEW", "FIX_PENDING", "REOPENED"],
          },
        },
      });
      if (existing) {
        await prisma.dataQualityIssue.update({
          where: { id: existing.id },
          data: {
            lastDetectedAt: new Date(),
            scanId: scan.id,
            evidence: f.evidence ?? existing.evidence,
            currentValue: f.currentValue ?? existing.currentValue,
            confidenceScore: f.confidenceScore ?? existing.confidenceScore,
          },
        });
        updated += 1;
        continue;
      }

      const resolvedSame = await prisma.dataQualityIssue.findFirst({
        where: {
          organizationId: input.actor.organizationId,
          issueKey: f.issueKey,
          status: { in: ["RESOLVED", "DISMISSED", "FALSE_POSITIVE"] },
        },
        orderBy: { updatedAt: "desc" },
      });
      if (resolvedSame && resolvedSame.status === "RESOLVED") {
        await prisma.dataQualityIssue.update({
          where: { id: resolvedSame.id },
          data: {
            status: "REOPENED",
            lastDetectedAt: new Date(),
            firstDetectedAt: resolvedSame.firstDetectedAt,
            scanId: scan.id,
            resolutionNote: null,
            resolvedAt: null,
            resolvedByUserId: null,
          },
        });
        updated += 1;
        continue;
      }

      await prisma.dataQualityIssue.create({
        data: {
          organizationId: input.actor.organizationId,
          issueKey: f.issueKey,
          module: f.module,
          entityType: f.entityType,
          entityId: f.entityId,
          secondaryEntityId: f.secondaryEntityId ?? null,
          issueType: f.issueType,
          severity: f.severity,
          status: "OPEN",
          title: f.title,
          description: f.description,
          fieldName: f.fieldName ?? null,
          currentValue: f.currentValue ?? null,
          expectedValue: f.expectedValue ?? null,
          evidence: f.evidence ?? null,
          confidenceScore: f.confidenceScore ?? null,
          ruleId: rule?.id ?? null,
          scanId: scan.id,
          detectedAt: new Date(),
          firstDetectedAt: new Date(),
          lastDetectedAt: new Date(),
        },
      });
      created += 1;
    }

    const completed = await prisma.dataQualityScan.update({
      where: { id: scan.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        recordsScanned: filtered.length,
        issuesFound: created + updated,
        criticalIssuesFound: critical,
      },
    });

    await writeAdminAudit({
      organizationId: input.actor.organizationId,
      actorId: input.actor.userId,
      action: "DATA_QUALITY_SCAN_COMPLETED",
      entityType: "DataQualityScan",
      entityId: scan.id,
      payload: { created, updated, critical },
    });

    return {
      ok: true as const,
      scan: serializeScan(completed),
      created,
      updated,
      critical,
      note: "Scan is read-only — source records were not modified.",
    };
  } catch (e) {
    await prisma.dataQualityScan.update({
      where: { id: scan.id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        errorsJson: JSON.stringify({
          message: e instanceof Error ? e.message : "Scan failed",
        }),
      },
    });
    await writeAdminAudit({
      organizationId: input.actor.organizationId,
      actorId: input.actor.userId,
      action: "DATA_QUALITY_SCAN_FAILED",
      entityType: "DataQualityScan",
      entityId: scan.id,
    });
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Scan failed.",
    };
  }
}

export function serializeScan(row: {
  id: string;
  scanType: string;
  status: string;
  modulesJson: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  recordsScanned: number | null;
  issuesFound: number | null;
  criticalIssuesFound: number | null;
  calculationVersion: string;
  createdAt: Date;
}) {
  return {
    id: row.id,
    scanType: row.scanType,
    status: row.status,
    modules: row.modulesJson ? JSON.parse(row.modulesJson) : [],
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    recordsScanned: row.recordsScanned,
    issuesFound: row.issuesFound,
    criticalIssuesFound: row.criticalIssuesFound,
    calculationVersion: row.calculationVersion,
    createdAt: row.createdAt.toISOString(),
  };
}

export function serializeIssue(
  row: {
    id: string;
    issueKey: string;
    module: string;
    entityType: string;
    entityId: string;
    secondaryEntityId: string | null;
    issueType: string;
    severity: string;
    status: string;
    title: string;
    description: string;
    fieldName: string | null;
    currentValue: string | null;
    expectedValue: string | null;
    evidence: string | null;
    confidenceScore: number | null;
    ruleId: string | null;
    scanId: string | null;
    assignedToUserId: string | null;
    detectedAt: Date;
    firstDetectedAt: Date;
    lastDetectedAt: Date;
    dueAt: Date | null;
    resolvedAt: Date | null;
    resolutionMethod: string | null;
    resolutionNote: string | null;
  },
  sensitive = false,
) {
  return {
    id: row.id,
    issueKey: row.issueKey,
    module: row.module,
    entityType: row.entityType,
    entityId: row.entityId,
    secondaryEntityId: row.secondaryEntityId,
    issueType: row.issueType,
    severity: row.severity,
    status: row.status,
    title: row.title,
    description: row.description,
    fieldName: row.fieldName,
    currentValue: sensitive ? row.currentValue : redact(row.currentValue),
    expectedValue: row.expectedValue,
    evidence: sensitive ? row.evidence : null,
    confidenceScore: row.confidenceScore,
    ruleId: row.ruleId,
    scanId: row.scanId,
    assignedToUserId: row.assignedToUserId,
    detectedAt: row.detectedAt.toISOString(),
    firstDetectedAt: row.firstDetectedAt.toISOString(),
    lastDetectedAt: row.lastDetectedAt.toISOString(),
    dueAt: row.dueAt?.toISOString() ?? null,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    resolutionMethod: row.resolutionMethod,
    resolutionNote: row.resolutionNote,
  };
}

function redact(value: string | null) {
  if (!value) return value;
  if (value.includes("@")) return "[redacted-email]";
  if (value.replace(/\D/g, "").length >= 10) return "[redacted-phone-or-id]";
  return value.length > 80 ? `${value.slice(0, 77)}...` : value;
}

export async function listDataQualityIssues(
  organizationId: string,
  filters?: {
    status?: string;
    severity?: string;
    module?: string;
    issueType?: string;
    assignedToUserId?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  },
) {
  const page = Math.max(1, filters?.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters?.pageSize ?? 25));
  const where: Record<string, unknown> = { organizationId };
  if (filters?.status) where.status = filters.status;
  if (filters?.severity) where.severity = filters.severity;
  if (filters?.module) where.module = filters.module;
  if (filters?.issueType) where.issueType = filters.issueType;
  if (filters?.assignedToUserId === "unassigned") {
    where.assignedToUserId = null;
  } else if (filters?.assignedToUserId) {
    where.assignedToUserId = filters.assignedToUserId;
  }
  if (filters?.search) {
    where.OR = [
      { title: { contains: filters.search } },
      { entityId: { contains: filters.search } },
      { description: { contains: filters.search } },
    ];
  }
  const [total, rows] = await Promise.all([
    prisma.dataQualityIssue.count({ where }),
    prisma.dataQualityIssue.findMany({
      where,
      orderBy: [{ severity: "asc" }, { lastDetectedAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return {
    total,
    page,
    pageSize,
    items: rows.map((r) => serializeIssue(r, false)),
  };
}

export async function assignDataQualityIssue(input: {
  actor: AdminActor;
  id: string;
  assignedToUserId: string;
  dueAt?: string | null;
  note?: string;
}) {
  const row = await prisma.dataQualityIssue.findFirst({
    where: { id: input.id, organizationId: input.actor.organizationId },
  });
  if (!row) return { ok: false as const, error: "Issue not found." };
  const updated = await prisma.dataQualityIssue.update({
    where: { id: row.id },
    data: {
      status: "ASSIGNED",
      assignedToUserId: input.assignedToUserId,
      assignedByUserId: input.actor.userId,
      dueAt: input.dueAt ? new Date(input.dueAt) : row.dueAt,
    },
  });
  await writeAdminAudit({
    organizationId: input.actor.organizationId,
    actorId: input.actor.userId,
    action: "DATA_QUALITY_ISSUE_ASSIGNED",
    entityType: "DataQualityIssue",
    entityId: row.id,
    payload: { assignedToUserId: input.assignedToUserId, note: input.note },
  });
  const { notifyDataQualityEvent } = await import("./notifications");
  notifyDataQualityEvent({
    type: "DATA_QUALITY_ISSUE_ASSIGNED",
    title: "Data quality issue assigned",
    message: `Issue assigned: ${row.title}`,
    userIds: [input.assignedToUserId],
    issueId: row.id,
    priority: row.severity === "CRITICAL" ? "HIGH" : "NORMAL",
  });
  return { ok: true as const, issue: serializeIssue(updated, true) };
}

export async function resolveDataQualityIssue(input: {
  actor: AdminActor;
  id: string;
  resolutionMethod: string;
  resolutionNote: string;
}) {
  if (!input.resolutionNote.trim()) {
    return { ok: false as const, error: "Resolution note is required." };
  }
  const row = await prisma.dataQualityIssue.findFirst({
    where: { id: input.id, organizationId: input.actor.organizationId },
  });
  if (!row) return { ok: false as const, error: "Issue not found." };
  const updated = await prisma.dataQualityIssue.update({
    where: { id: row.id },
    data: {
      status: "RESOLVED",
      resolvedAt: new Date(),
      resolvedByUserId: input.actor.userId,
      resolutionMethod: input.resolutionMethod,
      resolutionNote: input.resolutionNote.trim().slice(0, 2000),
    },
  });
  await writeAdminAudit({
    organizationId: input.actor.organizationId,
    actorId: input.actor.userId,
    action: "DATA_QUALITY_ISSUE_RESOLVED",
    entityType: "DataQualityIssue",
    entityId: row.id,
  });
  return { ok: true as const, issue: serializeIssue(updated, true) };
}

export async function dismissDataQualityIssue(input: {
  actor: AdminActor;
  id: string;
  reason: string;
  asFalsePositive?: boolean;
}) {
  if (!input.reason.trim()) {
    return { ok: false as const, error: "Reason is required." };
  }
  const row = await prisma.dataQualityIssue.findFirst({
    where: { id: input.id, organizationId: input.actor.organizationId },
  });
  if (!row) return { ok: false as const, error: "Issue not found." };
  const updated = await prisma.dataQualityIssue.update({
    where: { id: row.id },
    data: {
      status: input.asFalsePositive ? "FALSE_POSITIVE" : "DISMISSED",
      dismissedAt: new Date(),
      dismissedByUserId: input.actor.userId,
      dismissalReason: input.reason.trim().slice(0, 2000),
    },
  });
  await writeAdminAudit({
    organizationId: input.actor.organizationId,
    actorId: input.actor.userId,
    action: input.asFalsePositive
      ? "DATA_QUALITY_ISSUE_FALSE_POSITIVE"
      : "DATA_QUALITY_ISSUE_DISMISSED",
    entityType: "DataQualityIssue",
    entityId: row.id,
  });
  return { ok: true as const, issue: serializeIssue(updated, true) };
}

export async function startDataQualityIssueReview(input: {
  actor: AdminActor;
  id: string;
}) {
  const row = await prisma.dataQualityIssue.findFirst({
    where: { id: input.id, organizationId: input.actor.organizationId },
  });
  if (!row) return { ok: false as const, error: "Issue not found." };
  const updated = await prisma.dataQualityIssue.update({
    where: { id: row.id },
    data: {
      status: "IN_REVIEW",
      acknowledgedAt: new Date(),
    },
  });
  await writeAdminAudit({
    organizationId: input.actor.organizationId,
    actorId: input.actor.userId,
    action: "DATA_QUALITY_ISSUE_REVIEW_STARTED",
    entityType: "DataQualityIssue",
    entityId: row.id,
  });
  return { ok: true as const, issue: serializeIssue(updated, true) };
}

export async function reopenDataQualityIssue(input: {
  actor: AdminActor;
  id: string;
  note: string;
}) {
  const row = await prisma.dataQualityIssue.findFirst({
    where: { id: input.id, organizationId: input.actor.organizationId },
  });
  if (!row) return { ok: false as const, error: "Issue not found." };
  const updated = await prisma.dataQualityIssue.update({
    where: { id: row.id },
    data: {
      status: "REOPENED",
      resolutionNote: input.note.slice(0, 2000),
      resolvedAt: null,
      resolvedByUserId: null,
    },
  });
  await writeAdminAudit({
    organizationId: input.actor.organizationId,
    actorId: input.actor.userId,
    action: "DATA_QUALITY_ISSUE_REOPENED",
    entityType: "DataQualityIssue",
    entityId: row.id,
  });
  return { ok: true as const, issue: serializeIssue(updated, true) };
}
