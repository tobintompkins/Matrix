/**
 * Patch 49C — System Health checks (safe, no secrets).
 */

import { prisma } from "@/lib/db/prisma";
import { isClerkConfigured } from "@/lib/auth/clerk-config";
import { getMatrixAssistPublicStatus } from "@/lib/matrix-assist/config";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import { listAdminJobRuns } from "./jobs";
import { getBackupStatus } from "./backups";
import { getVersionInformation } from "./version";

export type HealthLevel =
  | "Operational"
  | "Degraded"
  | "Configuration Required"
  | "Unavailable"
  | "Unknown";

export type HealthCheck = {
  id: string;
  name: string;
  status: HealthLevel;
  summary: string;
  checkedAt: string;
};

export type SystemHealthSnapshot = {
  overall: HealthLevel;
  checks: HealthCheck[];
  recordCounts: Record<string, number | string>;
  alerts: string[];
};

export async function getSystemHealth(
  organizationId = DEFAULT_ORG_ID,
): Promise<SystemHealthSnapshot> {
  const checkedAt = new Date().toISOString();
  const checks: HealthCheck[] = [];
  const alerts: string[] = [];

  // Application
  const version = getVersionInformation();
  checks.push({
    id: "application",
    name: "Application",
    status: "Operational",
    summary: `Environment ${version.environment} · Version ${version.version}`,
    checkedAt,
  });

  // Database
  let dbStatus: HealthLevel = "Operational";
  let dbSummary = "Database connectivity verified.";
  let latencyMs: number | null = null;
  try {
    const t0 = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    latencyMs = Date.now() - t0;
    dbSummary = `Connected · query latency ~${latencyMs}ms`;
  } catch {
    dbStatus = "Unavailable";
    dbSummary = "Database connectivity check failed.";
    alerts.push("Database connectivity failed");
  }
  checks.push({
    id: "database",
    name: "Database",
    status: dbStatus,
    summary: dbSummary,
    checkedAt,
  });

  // Auth
  const clerkOk = isClerkConfigured();
  checks.push({
    id: "authentication",
    name: "Authentication",
    status: clerkOk ? "Operational" : "Configuration Required",
    summary: clerkOk
      ? "Clerk: Configured"
      : "Clerk: Not Configured — set publishable and secret keys.",
    checkedAt,
  });
  if (!clerkOk) alerts.push("Authentication provider not fully configured");

  // AI
  const assist = getMatrixAssistPublicStatus();
  let aiStatus: HealthLevel = "Configuration Required";
  let aiSummary = "Matrix Assist disabled or not configured.";
  if (assist.enabled && assist.configured) {
    aiStatus = "Operational";
    aiSummary = `Matrix Assist enabled · provider ${assist.provider}`;
  } else if (assist.enabled && !assist.configured) {
    aiStatus = "Configuration Required";
    aiSummary = "Matrix Assist enabled but provider credentials are incomplete.";
    alerts.push("AI provider configuration incomplete");
  } else {
    aiStatus = "Unknown";
    aiSummary = "Matrix Assist is disabled via environment.";
  }
  checks.push({
    id: "ai",
    name: "AI Provider",
    status: aiStatus,
    summary: aiSummary,
    checkedAt,
  });

  // Email
  checks.push({
    id: "email",
    name: "Email",
    status: "Configuration Required",
    summary:
      "No email delivery provider is configured in Matrix. In-app notifications only.",
    checkedAt,
  });

  // Storage
  checks.push({
    id: "storage",
    name: "File Storage",
    status: "Unknown",
    summary:
      "Attachment storage uses application placeholders; dedicated object storage is not configured.",
    checkedAt,
  });

  // Jobs
  const jobs = listAdminJobRuns();
  const failed = jobs.filter((j) => j.status === "Failed").length;
  checks.push({
    id: "jobs",
    name: "Background Jobs",
    status: failed > 0 ? "Degraded" : "Operational",
    summary:
      failed > 0
        ? `${failed} failed admin job run(s) in local job history.`
        : "No dedicated queue exists. Admin tool runs are tracked in-app.",
    checkedAt,
  });
  if (failed > 0) alerts.push("Failed background/admin jobs require review");

  // Backups
  const backup = getBackupStatus();
  checks.push({
    id: "backups",
    name: "Backups",
    status: backup.status,
    summary: backup.summary,
    checkedAt,
  });

  // Notifications
  checks.push({
    id: "notifications",
    name: "Notifications",
    status: "Degraded",
    summary:
      "In-app notification prototype is available. Email/SMS/push delivery is not configured.",
    checkedAt,
  });

  // Record counts (efficient Prisma aggregates + notes for session stores)
  const recordCounts: Record<string, number | string> = {
    adminUsers: "—",
    auditEvents: "—",
    adminRegions: "—",
  };
  if (dbStatus === "Operational") {
    try {
      const [users, audits, regions] = await Promise.all([
        prisma.adminDirectoryUser.count({ where: { organizationId } }),
        prisma.auditLog.count({ where: { organizationId } }),
        prisma.adminRegion.count({ where: { organizationId } }),
      ]);
      recordCounts.adminUsers = users;
      recordCounts.auditEvents = audits;
      recordCounts.adminRegions = regions;
    } catch {
      recordCounts.note = "Record counts unavailable";
    }
  }

  const statuses = checks.map((c) => c.status);
  let overall: HealthLevel = "Operational";
  if (statuses.includes("Unavailable")) overall = "Unavailable";
  else if (statuses.includes("Degraded")) overall = "Degraded";
  else if (statuses.includes("Configuration Required"))
    overall = "Configuration Required";

  return { overall, checks, recordCounts, alerts };
}
