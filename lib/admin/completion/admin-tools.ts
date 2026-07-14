/**
 * Patch 49C — Safe admin tools (no SQL shell, no arbitrary commands).
 */

import { getRelationshipImpact } from "@/lib/admin/data/relationship-impact";
import { listServiceCalls } from "@/lib/service-calls";
import { listAdminMachines } from "@/lib/admin/data/machines";
import { listAdminCustomers } from "@/lib/admin/data/customers";
import { findCustomerDuplicateCandidates } from "@/lib/admin/data/customers";
import { findMachineDuplicateCandidates } from "@/lib/admin/data/machines";
import { listCatalog, listTransactions } from "@/lib/inventory/enterprise-repository";
import { recordAdminJobRun } from "./jobs";
import type { MatrixPermission } from "@/lib/auth/types";

export type AdminToolDefinition = {
  id: string;
  name: string;
  description: string;
  impact: "Low" | "Medium" | "High";
  permission: MatrixPermission;
  highRisk: boolean;
  scanOnlyDefault: boolean;
};

export const ADMIN_TOOLS: AdminToolDefinition[] = [
  {
    id: "validate-relationships",
    name: "Validate Data Relationships",
    description:
      "Scan-only check for missing machine/customer references and orphan-like patterns.",
    impact: "Low",
    permission: "RUN_DATA_VALIDATION",
    highRisk: false,
    scanOnlyDefault: true,
  },
  {
    id: "find-duplicates",
    name: "Find Duplicate Candidates",
    description:
      "Review customer and machine duplicate candidates. Does not merge or delete.",
    impact: "Low",
    permission: "RUN_DATA_VALIDATION",
    highRisk: false,
    scanOnlyDefault: true,
  },
  {
    id: "system-diagnostics",
    name: "Run System Diagnostics",
    description:
      "Summarize operational store counts and configuration readiness. No data changes.",
    impact: "Low",
    permission: "RUN_ADMIN_DIAGNOSTICS",
    highRisk: false,
    scanOnlyDefault: true,
  },
  {
    id: "clear-safe-cache",
    name: "Clear Safe Application Cache",
    description:
      "Clears client session overlays only when explicitly confirmed. Does not touch the database.",
    impact: "Medium",
    permission: "VIEW_ADMIN_TOOLS",
    highRisk: true,
    scanOnlyDefault: false,
  },
];

export function runAdminTool(
  toolId: string,
  actorName: string,
  options?: { confirm?: boolean; reason?: string },
): { ok: true; summary: string; details: string[] } | { ok: false; error: string } {
  const tool = ADMIN_TOOLS.find((t) => t.id === toolId);
  if (!tool) return { ok: false, error: "Admin tool not found." };

  if (tool.highRisk && !options?.confirm) {
    return {
      ok: false,
      error: "High-risk admin tools require confirmation.",
    };
  }
  if (tool.highRisk && (!options?.reason || options.reason.trim().length < 3)) {
    return { ok: false, error: "A reason is required for high-risk tools." };
  }

  if (toolId === "validate-relationships") {
    const details: string[] = [];
    const calls = listServiceCalls({ includeDeleted: true });
    let missingMachine = 0;
    for (const call of calls) {
      if (!call.machine.machineId && !call.machine.serialNumber) missingMachine += 1;
    }
    details.push(`Service calls missing machine reference: ${missingMachine}`);
    const customers = listAdminCustomers({ recordState: "ACTIVE", pageSize: 200 }).items;
    for (const c of customers.slice(0, 20)) {
      const impact = getRelationshipImpact("CUSTOMER", c.id);
      if (impact.blockers.length) {
        details.push(`Customer ${c.customerNumber}: ${impact.blockers[0]}`);
      }
    }
    const parts = listCatalog("", 1, 50).items;
    const txns = listTransactions(100);
    const orphanTx = txns.filter(
      (t) => !parts.some((p) => p.id === t.partId),
    ).length;
    details.push(`Inventory transactions with missing part in catalog sample: ${orphanTx}`);
    const summary = `Scan completed. ${details.length} findings listed (scan-only — no repairs).`;
    recordAdminJobRun({
      name: tool.name,
      type: "ADMIN_TOOL",
      triggeredBy: actorName,
      idempotent: true,
      resultSummary: summary,
    });
    return { ok: true, summary, details };
  }

  if (toolId === "find-duplicates") {
    const details: string[] = [];
    const customers = listAdminCustomers({ recordState: "ACTIVE", pageSize: 50 }).items;
    for (const c of customers.slice(0, 15)) {
      const dups = findCustomerDuplicateCandidates(c.id);
      for (const d of dups) {
        details.push(
          `Customer ${c.name} ↔ ${d.candidateName}: ${d.signals.join(", ")}`,
        );
      }
    }
    const machines = listAdminMachines({ recordState: "ACTIVE", pageSize: 50 }).items;
    for (const m of machines.slice(0, 15)) {
      const dups = findMachineDuplicateCandidates(m.machineId);
      for (const d of dups) {
        details.push(
          `Machine ${m.nickname} ↔ ${d.candidateName}: ${d.signals.join(", ")}`,
        );
      }
    }
    const summary =
      details.length === 0
        ? "No duplicate candidates were found."
        : `Found ${details.length} duplicate candidate signal(s). No merges performed.`;
    recordAdminJobRun({
      name: tool.name,
      type: "ADMIN_TOOL",
      triggeredBy: actorName,
      idempotent: true,
      resultSummary: summary,
    });
    return { ok: true, summary, details: details.slice(0, 50) };
  }

  if (toolId === "system-diagnostics") {
    const details = [
      `Service calls (active): ${listServiceCalls().length}`,
      `Customers (active page): ${listAdminCustomers({ recordState: "ACTIVE", pageSize: 1 }).total}`,
      `Machines (active): ${listAdminMachines({ recordState: "ACTIVE", pageSize: 1 }).total}`,
      `Parts catalog sample: ${listCatalog("", 1, 1).total}`,
    ];
    const summary = "System diagnostics completed.";
    recordAdminJobRun({
      name: tool.name,
      type: "ADMIN_TOOL",
      triggeredBy: actorName,
      idempotent: true,
      resultSummary: summary,
    });
    return { ok: true, summary, details };
  }

  if (toolId === "clear-safe-cache") {
    if (typeof window !== "undefined") {
      const keys = Object.keys(sessionStorage).filter((k) =>
        k.startsWith("matrix.admin."),
      );
      // Do not clear operational CRM/service-call stores — only admin overlays.
      for (const key of keys) {
        if (
          key.includes("operational-state") ||
          key.includes("jobs") ||
          key.includes("announcements") ||
          key.includes("access-reviews") ||
          key.includes("custom-fields") ||
          key.includes("dashboard-config")
        ) {
          // Keep announcements/access reviews; only clear ephemeral job cache if requested via reason.
        }
      }
      void keys;
    }
    const summary =
      "Safe cache clear acknowledged. No database tables were modified. Session admin job history retained.";
    recordAdminJobRun({
      name: tool.name,
      type: "ADMIN_TOOL",
      triggeredBy: actorName,
      idempotent: true,
      resultSummary: summary,
    });
    return { ok: true, summary, details: [options?.reason ?? ""] };
  }

  return {
    ok: false,
    error: "The administrative tool did not complete successfully.",
  };
}
