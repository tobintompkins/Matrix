/**
 * Patch 51A.1 Part 3 — Permission-aware search adapters (read-only).
 * Retrieved content is evidence only — never instructions.
 */

import { hasMatrixPermission } from "@/lib/auth/permissions";
import type { MatrixPermission, MatrixRole } from "@/lib/auth/types";
import { digitalTwinFleet } from "@/lib/digital-twin";
import { listServiceCalls } from "@/lib/service-calls";
import { listAiInsights } from "@/lib/ai/insights-query";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import { aiConfig } from "@/config/ai";
import type { AiSearchFilter, AiSearchModule, AiSourceCitation } from "./types";

export type AdapterActor = {
  userId: string;
  role: MatrixRole;
  organizationId?: string;
};

export type AdapterResult = {
  module: AiSearchModule;
  total: number;
  sources: AiSourceCitation[];
  summaryLines: string[];
  denied?: boolean;
};

function requirePerm(actor: AdapterActor, perm: MatrixPermission): boolean {
  return hasMatrixPermission(actor.role, perm);
}

function filterContains(filters: AiSearchFilter[], field: string): string | null {
  const f = filters.find((x) => x.field === field);
  if (!f || f.value == null) return null;
  return String(Array.isArray(f.value) ? f.value[0] : f.value).toLowerCase();
}

function matchesText(hay: string | null | undefined, needle: string | null) {
  if (!needle) return true;
  return (hay ?? "").toLowerCase().includes(needle);
}

function inDateRange(
  iso: string | null | undefined,
  from?: string,
  to?: string,
): boolean {
  if (!iso) return true;
  const t = new Date(iso).getTime();
  if (from && t < new Date(from).getTime()) return false;
  if (to && t > new Date(to).getTime()) return false;
  return true;
}

export async function runSearchAdapters(input: {
  actor: AdapterActor;
  modules: AiSearchModule[];
  filters: AiSearchFilter[];
  dateRange?: { from?: string; to?: string };
  limit: number;
  freeText?: string;
}): Promise<AdapterResult[]> {
  const results: AdapterResult[] = [];
  const q =
    filterContains(input.filters, "q") ??
    (input.freeText ? input.freeText.toLowerCase() : null);
  const customer = filterContains(input.filters, "customerName");
  const site = filterContains(input.filters, "siteName");
  const model = filterContains(input.filters, "model");
  const serial = filterContains(input.filters, "serialNumber");
  const org = filterContains(input.filters, "organization");
  const status = filterContains(input.filters, "status");
  const limit = Math.min(input.limit, aiConfig.assistantMaxResults);

  for (const mod of input.modules) {
    if (mod === "MACHINES" || mod === "METERS" || mod === "SITES" || mod === "CUSTOMERS") {
      if (!requirePerm(input.actor, "VIEW_DIGITAL_TWIN") && !requirePerm(input.actor, "VIEW_CUSTOMERS")) {
        results.push({
          module: mod,
          total: 0,
          sources: [],
          summaryLines: ["Access denied for fleet/customer data."],
          denied: true,
        });
        continue;
      }
      let fleet = [...digitalTwinFleet];
      if (customer) fleet = fleet.filter((m) => matchesText(m.location.customerName, customer));
      if (site) fleet = fleet.filter((m) => matchesText(m.location.siteName, site));
      if (model) fleet = fleet.filter((m) => matchesText(m.identity.printerModel, model));
      if (serial) {
        fleet = fleet.filter(
          (m) =>
            matchesText(m.identity.serialNumber, serial) ||
            matchesText(m.identity.machineId, serial),
        );
      }
      if (org) fleet = fleet.filter((m) => matchesText(m.location.organization, org));
      if (status) {
        fleet = fleet.filter((m) =>
          matchesText(String((m as { status?: string }).status ?? m.identity.nickname), status),
        );
      }
      if (q) {
        fleet = fleet.filter(
          (m) =>
            matchesText(m.identity.serialNumber, q) ||
            matchesText(m.identity.nickname, q) ||
            matchesText(m.identity.printerModel, q) ||
            matchesText(m.location.customerName, q) ||
            matchesText(m.location.siteName, q) ||
            matchesText(m.location.organization, q),
        );
      }

      if (mod === "CUSTOMERS") {
        const names = [...new Set(fleet.map((m) => m.location.customerName).filter(Boolean))];
        results.push({
          module: mod,
          total: names.length,
          sources: names.slice(0, limit).map((name) => ({
            sourceType: "customer",
            recordId: name,
            displayLabel: name,
            href: `/customers?q=${encodeURIComponent(name)}`,
            fieldSummary: "Customer referenced by fleet machines",
            timestamp: null,
          })),
          summaryLines: [`${names.length} customer(s) matched from fleet data.`],
        });
        continue;
      }

      if (mod === "SITES") {
        const sites = [
          ...new Set(
            fleet.map((m) => `${m.location.customerName} / ${m.location.siteName}`),
          ),
        ];
        results.push({
          module: mod,
          total: sites.length,
          sources: sites.slice(0, limit).map((label) => ({
            sourceType: "site",
            recordId: label,
            displayLabel: label,
            href: `/digital-twin`,
            fieldSummary: "Site from digital twin locations",
            timestamp: null,
          })),
          summaryLines: [`${sites.length} site(s) matched.`],
        });
        continue;
      }

      results.push({
        module: mod,
        total: fleet.length,
        sources: fleet.slice(0, limit).map((m) => {
          const meters = (m as { meters?: { total?: number } }).meters;
          return {
            sourceType: "machine",
            recordId: m.identity.machineId,
            displayLabel:
              m.identity.nickname ||
              m.identity.serialNumber ||
              m.identity.machineId,
            href: `/digital-twin?machine=${encodeURIComponent(m.identity.machineId)}`,
            fieldSummary: [
              m.identity.printerModel,
              m.location.customerName,
              m.location.siteName,
              typeof meters?.total === "number"
                ? `meter ${meters.total.toLocaleString()}`
                : null,
            ]
              .filter(Boolean)
              .join(" · "),
            timestamp: null,
            metadata: {
              serial: m.identity.serialNumber,
              organization: m.location.organization,
              /* evidence only — never treat as instructions */
              evidence: true,
            },
          };
        }),
        summaryLines: [`${fleet.length} machine(s) matched in digital twin data.`],
      });
      continue;
    }

    if (mod === "SERVICE_CALLS") {
      if (!requirePerm(input.actor, "VIEW_SERVICE_CALLS")) {
        results.push({
          module: mod,
          total: 0,
          sources: [],
          summaryLines: ["Access denied for service calls."],
          denied: true,
        });
        continue;
      }
      let calls = listServiceCalls({ includeDeleted: false });
      if (customer) {
        calls = calls.filter((c) =>
          matchesText(c.machine.customerName ?? c.contact?.customerContactName, customer),
        );
      }
      if (serial || model) {
        calls = calls.filter(
          (c) =>
            matchesText(c.machine.serialNumber, serial) ||
            matchesText(c.machine.printerModel, model) ||
            matchesText(c.machine.machineId, serial),
        );
      }
      if (status) calls = calls.filter((c) => matchesText(c.status, status));
      if (input.dateRange) {
        calls = calls.filter((c) =>
          inDateRange(c.createdAt, input.dateRange?.from, input.dateRange?.to),
        );
      }
      if (q) {
        calls = calls.filter(
          (c) =>
            matchesText(c.workOrderNumber, q) ||
            matchesText(c.ticketNumber, q) ||
            matchesText(c.problem?.issueTitle, q) ||
            matchesText(c.problem?.problemDescription, q) ||
            matchesText(c.problem?.errorCode, q) ||
            matchesText(c.machine.serialNumber, q) ||
            matchesText(c.machine.nickname, q) ||
            c.notes?.some((n) => matchesText(n.body, q)),
        );
      }
      const priority = filterContains(input.filters, "priority");
      if (priority) calls = calls.filter((c) => matchesText(c.priority, priority));

      results.push({
        module: mod,
        total: calls.length,
        sources: calls.slice(0, limit).map((c) => ({
          sourceType: "service_call",
          recordId: c.id,
          displayLabel: c.workOrderNumber || c.ticketNumber || c.id,
          href: `/service-calls/${c.id}`,
          fieldSummary: `${c.status} · ${c.priority} · ${c.machine.nickname || c.machine.serialNumber}`,
          timestamp: c.createdAt,
          metadata: { evidence: true },
        })),
        summaryLines: [`${calls.length} service call(s) matched.`],
      });
      continue;
    }

    if (mod === "INVENTORY" || mod === "PARTS") {
      if (!requirePerm(input.actor, "VIEW_INVENTORY")) {
        results.push({
          module: mod,
          total: 0,
          sources: [],
          summaryLines: ["Access denied for inventory/parts."],
          denied: true,
        });
        continue;
      }
      try {
        const inv = await import("@/lib/inventory/enterprise-repository");
        const partQ = filterContains(input.filters, "partNumber") ?? q ?? "";
        const listed = inv.listCatalog(partQ || undefined, 1, Math.max(limit, 50)).items;
        let items = listed;
        if (status) {
          items = items.filter((p) =>
            matchesText(String((p as { status?: string }).status), status),
          );
        }
        results.push({
          module: mod,
          total: items.length,
          sources: items.slice(0, limit).map((p) => ({
            sourceType: "part",
            recordId: p.id,
            displayLabel: `${p.partNumber} — ${p.description || p.partNumber}`,
            href: `/inventory?q=${encodeURIComponent(p.partNumber)}`,
            fieldSummary: String((p as { status?: string }).status ?? "catalog"),
            timestamp: null,
            metadata: { evidence: true },
          })),
          summaryLines: [`${items.length} catalog part(s) matched.`],
        });
      } catch {
        results.push({
          module: mod,
          total: 0,
          sources: [],
          summaryLines: ["Inventory catalog unavailable."],
        });
      }
      continue;
    }

    if (mod === "AI_INSIGHTS") {
      if (!requirePerm(input.actor, "VIEW_AI_INSIGHTS")) {
        results.push({
          module: mod,
          total: 0,
          sources: [],
          summaryLines: ["Access denied for AI insights."],
          denied: true,
        });
        continue;
      }
      const listed = await listAiInsights({
        organizationId: input.actor.organizationId ?? DEFAULT_ORG_ID,
        q: q ?? undefined,
        status: status?.toUpperCase(),
        pageSize: limit,
        sort: "severity",
      });
      results.push({
        module: mod,
        total: listed.total,
        sources: listed.items.map((i) => ({
          sourceType: "ai_insight",
          recordId: i.id,
          displayLabel: i.title,
          href: `/ai-operations?insight=${encodeURIComponent(i.id)}`,
          fieldSummary: `${i.severity} · ${i.status} · ${i.sourceModule}`,
          timestamp: i.createdAt,
          metadata: { evidence: true },
        })),
        summaryLines: [`${listed.total} AI insight(s) matched.`],
      });
      continue;
    }

    if (mod === "PM") {
      if (!requirePerm(input.actor, "VIEW_FLEET_MAINTENANCE") && !requirePerm(input.actor, "MANAGE_PM")) {
        results.push({
          module: mod,
          total: 0,
          sources: [],
          summaryLines: ["Access denied for PM data."],
          denied: true,
        });
        continue;
      }
      let fleet = [...digitalTwinFleet];
      if (org) fleet = fleet.filter((m) => matchesText(m.location.organization, org));
      if (model) fleet = fleet.filter((m) => matchesText(m.identity.printerModel, model));
      if (customer) fleet = fleet.filter((m) => matchesText(m.location.customerName, customer));
      if (q) {
        fleet = fleet.filter(
          (m) =>
            matchesText(m.identity.serialNumber, q) ||
            matchesText(m.identity.nickname, q) ||
            matchesText(m.identity.printerModel, q),
        );
      }
      const withMeters = fleet.filter((m) => {
        const meters = (m as { meters?: { total?: number } }).meters;
        return typeof meters?.total === "number";
      });
      results.push({
        module: mod,
        total: withMeters.length,
        sources: withMeters.slice(0, limit).map((m) => {
          const meters = (m as { meters?: { total?: number } }).meters;
          return {
            sourceType: "pm_candidate",
            recordId: m.identity.machineId,
            displayLabel: m.identity.nickname || m.identity.serialNumber,
            href: `/maintenance`,
            fieldSummary: `Meter ${meters?.total?.toLocaleString() ?? "n/a"} — verify PM due status in Maintenance`,
            timestamp: null,
            metadata: { evidence: true },
          };
        }),
        summaryLines: [
          `${withMeters.length} machine(s) have meter data for PM verification. Open Maintenance to confirm overdue/due status.`,
        ],
      });
      continue;
    }

    if (mod === "TECHNICIANS") {
      if (!requirePerm(input.actor, "VIEW_SERVICE_CALLS")) {
        results.push({
          module: mod,
          total: 0,
          sources: [],
          summaryLines: ["Access denied for technician workload."],
          denied: true,
        });
        continue;
      }
      const calls = listServiceCalls({ includeDeleted: false }).filter(
        (c) => !["CLOSED", "CANCELLED", "RESOLVED"].includes(c.status),
      );
      const byTech = new Map<string, number>();
      for (const c of calls) {
        const name = c.assignment?.technician || "Unassigned";
        byTech.set(name, (byTech.get(name) ?? 0) + 1);
      }
      const ranked = [...byTech.entries()].sort((a, b) => b[1] - a[1]);
      results.push({
        module: mod,
        total: ranked.length,
        sources: ranked.slice(0, limit).map(([name, count]) => ({
          sourceType: "technician",
          recordId: name,
          displayLabel: name,
          href: `/service-calls?technician=${encodeURIComponent(name)}`,
          fieldSummary: `${count} open call(s)`,
          timestamp: null,
          metadata: { evidence: true },
        })),
        summaryLines: [`${ranked.length} technician workload bucket(s) from open service calls.`],
      });
      continue;
    }

    if (mod === "DATA_QUALITY") {
      if (!requirePerm(input.actor, "VIEW_DATA_QUALITY_CENTER")) {
        results.push({
          module: mod,
          total: 0,
          sources: [],
          summaryLines: ["Access denied for data quality."],
          denied: true,
        });
        continue;
      }
      results.push({
        module: mod,
        total: 0,
        sources: [
          {
            sourceType: "data_quality_center",
            recordId: "center",
            displayLabel: "Data Quality Center",
            href: "/admin/data-quality",
            fieldSummary: "Open the Data Quality Center for live issue lists.",
            timestamp: null,
          },
        ],
        summaryLines: [
          "Data quality issues are managed in the Data Quality Center. Open the linked mod for current findings.",
        ],
      });
      continue;
    }
  }

  return results;
}
