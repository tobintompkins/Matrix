import { NextRequest, NextResponse } from "next/server";
import { requirePortalAccess } from "@/lib/portal/auth";
import { setActivePortalMembership } from "@/lib/portal/repository";
import { answerCustomerAssist } from "@/lib/matrix-assist/customer-mode";
import { writeAdminAudit } from "@/lib/admin/repository";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const gate = await requirePortalAccess("ACCESS_CUSTOMER_PORTAL");
  if (!gate.ok) return gate.response;
  setActivePortalMembership(gate.membership.id);

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const question =
    typeof body.question === "string"
      ? body.question
      : "How do I get help with my printer?";
  const answer = answerCustomerAssist({
    question,
    audience: "customer",
    machineLabel:
      typeof body.machineLabel === "string" ? body.machineLabel : undefined,
    ticketStatus:
      typeof body.ticketStatus === "string" ? body.ticketStatus : undefined,
  });

  await writeAdminAudit({
    organizationId: DEFAULT_ORG_ID,
    actorId: gate.actor.userId,
    action: "PORTAL_CUSTOMER_ASSIST_ASKED",
    entityType: "CustomerPortal",
    message: question.slice(0, 200),
    category: "CUSTOMER_PORTAL",
    severity: "INFO",
    outcome: "SUCCESS",
  }).catch(() => undefined);

  return NextResponse.json({ ok: true, ...answer });
}
