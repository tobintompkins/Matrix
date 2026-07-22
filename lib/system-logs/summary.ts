/**
 * Patch 50C-2 — Dashboard summary + Org Health aggregate (live AuditLog data).
 */

import type { AdminActor } from "@/lib/admin/auth";
import { writeAdminAudit } from "@/lib/admin/repository";
import { prisma } from "@/lib/db/prisma";
import { classifyAction } from "./taxonomy";
import { ensureSystemLogFoundation, getSystemLogSettings } from "./settings";
import { normalizeAuditRow, type AuditLogRow } from "./serializer";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getSystemLogsAggregateForOrgHealth(organizationId: string) {
  const settings = await getSystemLogSettings(organizationId);
  if (!settings.enabled) {
    return {
      enabled: false,
      criticalSecurityEvents: 0,
      unresolvedCriticalEvents: 0,
      apiErrorCountToday: 0,
      applicationErrorCountToday: 0,
      href: "/admin/system-logs",
    };
  }
  const today = startOfToday();
  const openSecurity = await prisma.systemSecurityEventState.count({
    where: {
      organizationId,
      status: { in: ["OPEN", "ACKNOWLEDGED", "ASSIGNED", "INVESTIGATING"] },
    },
  });
  const criticalToday = await prisma.auditLog.count({
    where: {
      organizationId,
      createdAt: { gte: today },
      OR: [{ severity: "CRITICAL" }, { category: "SECURITY" }],
    },
  });
  const apiErrors = await prisma.auditLog.count({
    where: {
      organizationId,
      createdAt: { gte: today },
      OR: [
        { category: "API", outcome: "FAILURE" },
        { category: "ERROR" },
      ],
    },
  });
  return {
    enabled: true,
    criticalSecurityEvents: criticalToday,
    unresolvedCriticalEvents: openSecurity,
    apiErrorCountToday: apiErrors,
    applicationErrorCountToday: apiErrors,
    href: "/admin/system-logs",
  };
}

export async function getSystemLogsSummary(actor: AdminActor) {
  await ensureSystemLogFoundation(actor.organizationId);
  const settings = await getSystemLogSettings(actor.organizationId);
  if (!settings.enabled) {
    return {
      ok: true as const,
      enabled: false,
      message: "System Logs is disabled for this organization.",
    };
  }

  const orgId = actor.organizationId;
  const today = startOfToday();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const recent = await prisma.auditLog.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  let eventsToday = 0;
  let securityEvents = 0;
  let failedLogins = 0;
  let apiErrors = 0;
  let applicationErrors = 0;
  let permissionChanges = 0;
  let dataChanges = 0;
  let exportsToday = 0;
  let integrationFailures = 0;
  const byCategory = new Map<string, number>();
  const bySeverity = new Map<string, number>();
  const byActor = new Map<string, number>();
  const criticalRecent: AuditLogRow[] = [];

  for (const row of recent) {
    const n = normalizeAuditRow(row as AuditLogRow);
    const inferred = classifyAction(row.action);
    const category = n.category;
    const severity = n.severity;
    byCategory.set(category, (byCategory.get(category) ?? 0) + 1);
    bySeverity.set(severity, (bySeverity.get(severity) ?? 0) + 1);
    if (row.actorId) {
      byActor.set(row.actorId, (byActor.get(row.actorId) ?? 0) + 1);
    }
    if (row.createdAt >= today) {
      eventsToday += 1;
      if (category === "EXPORT") exportsToday += 1;
    }
    if (category === "SECURITY" || inferred.isSecurityCandidate) {
      securityEvents += 1;
    }
    if (category === "AUTHENTICATION" && n.outcome === "FAILURE") {
      failedLogins += 1;
    }
    if (
      (category === "API" && n.outcome === "FAILURE") ||
      (typeof row.statusCode === "number" && row.statusCode >= 500)
    ) {
      apiErrors += 1;
    }
    if (category === "ERROR" || severity === "ERROR" || severity === "CRITICAL") {
      applicationErrors += 1;
      if (criticalRecent.length < 12) criticalRecent.push(row as AuditLogRow);
    }
    if (category === "AUTHORIZATION") permissionChanges += 1;
    if (category === "DATA_CHANGE") dataChanges += 1;
    if (category === "INTEGRATION" && n.outcome === "FAILURE") {
      integrationFailures += 1;
    }
  }

  const unresolvedCritical = await prisma.systemSecurityEventState.count({
    where: {
      organizationId: orgId,
      status: { in: ["OPEN", "ACKNOWLEDGED", "ASSIGNED", "INVESTIGATING"] },
    },
  });

  const recentAdmin = recent
    .filter((r) =>
      /ADMIN|CONFIG|SETTINGS|ROLE|PERMISSION|FEATURE/i.test(r.action),
    )
    .slice(0, 8)
    .map((r) => normalizeAuditRow(r as AuditLogRow));

  const weekRows = recent.filter((r) => r.createdAt >= weekAgo);
  const errorTrend = [0, 0, 0, 0, 0, 0, 0];
  for (const r of weekRows) {
    const day = Math.min(
      6,
      Math.floor((Date.now() - r.createdAt.getTime()) / (24 * 60 * 60 * 1000)),
    );
    const n = normalizeAuditRow(r as AuditLogRow);
    if (n.category === "ERROR" || n.severity === "ERROR" || n.severity === "CRITICAL") {
      errorTrend[6 - day] += 1;
    }
  }

  try {
    await writeAdminAudit({
      organizationId: orgId,
      actorId: actor.userId,
      action: "SYSTEM_LOGS_VIEWED",
      entityType: "SystemLogs",
      entityId: orgId,
      category: "AUDIT",
      severity: "INFO",
      outcome: "SUCCESS",
    });
  } catch {
    // Viewing must not fail if audit write is unavailable.
  }

  return {
    ok: true as const,
    enabled: true,
    cards: {
      eventsToday,
      securityEvents,
      failedLogins,
      apiErrors,
      applicationErrors,
      backgroundJobFailures: 0,
      integrationFailures,
      permissionChanges,
      dataChanges,
      exportsToday,
      unresolvedCriticalEvents: unresolvedCritical,
      averageErrorRate:
        eventsToday === 0
          ? 0
          : Math.round(((apiErrors + applicationErrors) / Math.max(eventsToday, 1)) * 1000) /
            10,
    },
    charts: {
      byCategory: [...byCategory.entries()].map(([key, count]) => ({ key, count })),
      bySeverity: [...bySeverity.entries()].map(([key, count]) => ({ key, count })),
      errorTrend,
      topActors: [...byActor.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([actorUserId, count]) => ({ actorUserId, count })),
    },
    recentCritical: criticalRecent.map((r) => normalizeAuditRow(r)),
    recentAdministrativeActions: recentAdmin,
    limitations: {
      backgroundJobs:
        "No durable background job queue is installed. Job history in /admin/jobs is session-local only and is not claimed here.",
      authenticationProvider:
        "Clerk does not expose failed-login payloads to Matrix. Authentication metrics reflect Matrix AuditLog events only; missing provider fields show as Not Available.",
      notificationDelivery:
        "In-app notifications are session-local. Delivery confirmation is Not Available unless a provider records AuditLog events.",
      automaticCleanup:
        "Retention settings are saved, but no cleanup scheduler is active. Use a documented cleanup command when available.",
    },
    links: {
      explorer: "/admin/system-logs/events",
      security: "/admin/system-logs/security",
      authentication: "/admin/system-logs/authentication",
      errors: "/admin/system-logs/errors",
      api: "/admin/system-logs/api",
      jobs: "/admin/system-logs/jobs",
      retention: "/admin/system-logs/retention",
      settings: "/admin/system-logs/settings",
      approvals: "/admin/approvals",
      dataQuality: "/admin/data-quality",
      organizationHealth: "/admin/organization-health",
    },
    quickActions: [
      { label: "Open Audit Explorer", href: "/admin/system-logs/events" },
      { label: "Review Security Events", href: "/admin/system-logs/security" },
      { label: "Review Failed Logins", href: "/admin/system-logs/authentication?outcome=FAILURE" },
      { label: "Review Application Errors", href: "/admin/system-logs/errors" },
      { label: "Review API Failures", href: "/admin/system-logs/api?outcome=FAILURE" },
      { label: "Review Failed Jobs", href: "/admin/system-logs/jobs" },
      { label: "Export Current Logs", href: "/api/system-logs/export?kind=events" },
      { label: "Manage Retention", href: "/admin/system-logs/retention" },
    ],
  };
}
