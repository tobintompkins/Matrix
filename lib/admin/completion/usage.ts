/**
 * Patch 49C — Usage & adoption aggregates from reliable operational stores.
 */

import { listServiceCalls } from "@/lib/service-calls";
import { listTransactions } from "@/lib/inventory/enterprise-repository";
import { listAdminCustomers } from "@/lib/admin/data/customers";
import { listAdminMachines } from "@/lib/admin/data/machines";
import { listDeletedRecords } from "@/lib/admin/data/deleted-records";

export type UsageAdoptionSummary = {
  modules: Array<{
    feature: string;
    enabled: boolean;
    recentUsage: number;
    adoptionStatus: string;
    detail: string;
  }>;
  totals: {
    serviceCallsCreated: number;
    inventoryTransactions: number;
    activeCustomers: number;
    activeMachines: number;
    deletedRecords: number;
  };
  notes: string[];
};

export function getUsageAnalytics(): UsageAdoptionSummary {
  const calls = listServiceCalls({ includeDeleted: false });
  const txns = listTransactions(500);
  const customers = listAdminCustomers({ recordState: "ACTIVE", pageSize: 1 });
  const machines = listAdminMachines({ recordState: "ACTIVE", pageSize: 1 });
  const deleted = listDeletedRecords({ pageSize: 1 });

  const last7 = daysAgo(7);
  const calls7 = calls.filter((c) => c.createdAt >= last7).length;
  const txns7 = txns.filter((t) => t.occurredAt >= last7).length;

  return {
    modules: [
      {
        feature: "Service Calls",
        enabled: true,
        recentUsage: calls7,
        adoptionStatus: calls7 > 0 ? "Active" : "Idle",
        detail: `${calls.length} active (non-deleted) service calls in store`,
      },
      {
        feature: "Inventory",
        enabled: true,
        recentUsage: txns7,
        adoptionStatus: txns7 > 0 ? "Active" : "Idle",
        detail: `${txns.length} recent inventory transactions`,
      },
      {
        feature: "Customers",
        enabled: true,
        recentUsage: customers.total,
        adoptionStatus: customers.total > 0 ? "Active" : "Idle",
        detail: "Active CRM customers",
      },
      {
        feature: "Machines",
        enabled: true,
        recentUsage: machines.total,
        adoptionStatus: machines.total > 0 ? "Active" : "Idle",
        detail: "Active digital twin machines",
      },
      {
        feature: "Data Administration",
        enabled: true,
        recentUsage: deleted.total,
        adoptionStatus: deleted.total > 0 ? "In use" : "Ready",
        detail: "Soft-deleted records in Deleted Records center",
      },
      {
        feature: "Matrix Assist",
        enabled: true,
        recentUsage: 0,
        adoptionStatus: "See Matrix Assist admin",
        detail:
          "Session/usage counts require Prisma Matrix Assist usage events (shown on Assist admin page).",
      },
      {
        feature: "Notifications",
        enabled: true,
        recentUsage: 0,
        adoptionStatus: "Prototype",
        detail:
          "In-app notification store is session-based; email/SMS delivery is not configured.",
      },
    ],
    totals: {
      serviceCallsCreated: calls.length,
      inventoryTransactions: txns.length,
      activeCustomers: customers.total,
      activeMachines: machines.total,
      deletedRecords: deleted.total,
    },
    notes: [
      "Usage metrics use reliable operational stores only — no fabricated personal tracking.",
      "Active-user day counts require Clerk activity sync and are not invented.",
    ],
  };
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}
