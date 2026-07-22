import { NextResponse } from "next/server";
import { requirePortalAccess } from "@/lib/portal/auth";
import { createInvitation } from "@/lib/portal/enterprise";
import { setActivePortalMembership } from "@/lib/portal/repository";
import { writeAdminAudit } from "@/lib/admin/repository";
import type { PortalCustomerRole } from "@/lib/portal/types";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES: PortalCustomerRole[] = [
  "CUSTOMER_ADMIN",
  "CUSTOMER_MANAGER",
  "CUSTOMER_USER",
  "CUSTOMER_VIEWER",
];

export async function POST(request: Request) {
  const gate = await requirePortalAccess("MANAGE_CUSTOMER_PORTAL_USERS");
  if (!gate.ok) return gate.response;
  setActivePortalMembership(gate.membership.id);
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const role = String(body.role ?? "CUSTOMER_USER") as PortalCustomerRole;
    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json(
        { ok: false, error: "Invalid portal role." },
        { status: 400 },
      );
    }
    // Never allow assigning internal Matrix roles
    if (!role.startsWith("CUSTOMER_")) {
      return NextResponse.json(
        { ok: false, error: "Internal roles cannot be assigned." },
        { status: 400 },
      );
    }
    const result = createInvitation({
      email: String(body.email ?? ""),
      displayName: String(
        body.displayName ??
          `${body.firstName ?? ""} ${body.lastName ?? ""}`.trim(),
      ),
      role,
      locationIds: Array.isArray(body.locationIds)
        ? (body.locationIds as string[])
        : [],
      printerIds: Array.isArray(body.machineIds)
        ? (body.machineIds as string[])
        : Array.isArray(body.printerIds)
          ? (body.printerIds as string[])
          : [],
      canApproveService: Boolean(body.canApproveService),
      canViewMeters: body.canViewMeters !== false,
      canViewPm: body.canViewPm !== false,
      canDownloadReports: body.canDownloadReports !== false,
      canManageUsers: role === "CUSTOMER_ADMIN",
    });
    if (!result.ok) return NextResponse.json(result, { status: 400 });
    await writeAdminAudit({
      organizationId: gate.actor.organizationId,
      actorId: gate.actor.userId,
      action: "PORTAL_USER_INVITED",
      entityType: "PortalInvitation",
      entityId: "invitation" in result ? String((result as { invitation?: { id?: string } }).invitation?.id ?? "") : "",
      payload: { customerId: gate.membership.customerId, role },
    });
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Invite failed." },
      { status: 400 },
    );
  }
}
