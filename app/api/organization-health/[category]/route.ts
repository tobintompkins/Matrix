import { NextResponse } from "next/server";
import { forbidUnless, resolveAdminActor } from "@/lib/admin/auth";
import { getOrganizationHealthDrilldown } from "@/lib/organization-health/summary";
import type { HealthCategoryKey } from "@/lib/organization-health/score";
import type { MatrixPermission } from "@/lib/auth/types";

export const dynamic = "force-dynamic";

const MAP: Record<string, { category: HealthCategoryKey | "alerts"; perm: MatrixPermission }> = {
  fleet: { category: "fleet", perm: "VIEW_FLEET_HEALTH" },
  service: { category: "service", perm: "VIEW_SERVICE_HEALTH" },
  pm: { category: "pm", perm: "VIEW_PM_HEALTH" },
  inventory: { category: "inventory", perm: "VIEW_INVENTORY_HEALTH" },
  technicians: { category: "technician", perm: "VIEW_TECHNICIAN_PRODUCTIVITY" },
  customers: { category: "customer", perm: "VIEW_CUSTOMER_HEALTH" },
  financial: { category: "financial", perm: "VIEW_FINANCIAL_HEALTH" },
  security: { category: "security", perm: "VIEW_ORGANIZATION_HEALTH" },
  alerts: { category: "alerts", perm: "VIEW_PREDICTIVE_ALERTS" },
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ category: string }> },
) {
  const actor = await resolveAdminActor();
  const { category } = await context.params;
  const entry = MAP[category];
  if (!entry) {
    return NextResponse.json({ ok: false, error: "Unknown category." }, { status: 404 });
  }
  const denied = forbidUnless(actor, entry.perm);
  if (denied) return denied;
  const data = await getOrganizationHealthDrilldown(actor, entry.category);
  if (!data.ok) {
    return NextResponse.json(data, { status: 403 });
  }
  return NextResponse.json(data);
}
