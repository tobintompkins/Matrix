import { NextRequest, NextResponse } from "next/server";
import { forbidUnlessAi, resolveAiActor } from "@/lib/ai/auth";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import { setCustomerRiskOverride } from "@/lib/executive-command-center/predictive-business/customer-operational-risk";

export const dynamic = "force-dynamic";

/**
 * Audited customer operational-risk override (does not write CRM production fields).
 */
export async function POST(req: NextRequest) {
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "MANAGE_EXECUTIVE_ALERTS");
  if (denied) return denied;

  try {
    const body = (await req.json().catch(() => ({}))) as {
      customerId?: string;
      score?: number;
      note?: string;
    };
    if (!body.customerId || typeof body.score !== "number") {
      return NextResponse.json(
        { ok: false, error: "customerId and score are required." },
        { status: 400 },
      );
    }
    const result = await setCustomerRiskOverride({
      organizationId: DEFAULT_ORG_ID,
      customerId: body.customerId,
      score: body.score,
      note: body.note || "",
      actorId: actor.userId,
      actorName: actor.displayName,
    });
    if (!result.ok) {
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json({ ok: true, override: result.override });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "Override failed.",
      },
      { status: 500 },
    );
  }
}
