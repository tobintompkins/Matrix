import { NextResponse } from "next/server";
import { forbidUnless, resolveAdminActor } from "@/lib/admin/auth";
import { delegateReview } from "@/lib/approvals";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Ctx) {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "DELEGATE_APPROVAL");
  if (denied) return denied;
  const { id } = await context.params;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const item = await delegateReview({
      id,
      actor,
      delegateUserId: String(body.delegateUserId ?? ""),
      delegateName: (body.delegateName as string) ?? null,
      reason: (body.reason as string) ?? null,
      startsAt: (body.startsAt as string) ?? null,
      endsAt: (body.endsAt as string) ?? null,
    });
    return NextResponse.json({ ok: true, item });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Delegate failed." },
      { status: 400 },
    );
  }
}
