import { NextResponse } from "next/server";
import { requirePortalAccess } from "@/lib/portal/auth";
import {
  createInvitation,
  listMembershipsForCustomer,
  listPendingInvitations,
} from "@/lib/portal/enterprise";
import { setActivePortalMembership } from "@/lib/portal/repository";
import { writeAdminAudit } from "@/lib/admin/repository";
import type { PortalCustomerRole } from "@/lib/portal/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requirePortalAccess("MANAGE_CUSTOMER_PORTAL_USERS");
  if (!gate.ok) return gate.response;
  setActivePortalMembership(gate.membership.id);
  return NextResponse.json({
    ok: true,
    users: listMembershipsForCustomer(gate.membership.customerId),
    invitations: listPendingInvitations(),
  });
}
