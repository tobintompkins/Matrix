import { NextResponse } from "next/server";
import { forbidUnless, resolveAdminActor } from "@/lib/admin/auth";
import { submitApprovalRequest } from "@/lib/approvals";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Ctx) {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "CREATE_APPROVAL_REQUEST");
  if (denied) return denied;
  const { id } = await context.params;

  try {
    let inventoryAdjustmentPercentage: number | null = null;
    try {
      const body = (await request.json()) as Record<string, unknown>;
      if (body.inventoryAdjustmentPercentage != null) {
        inventoryAdjustmentPercentage = Number(body.inventoryAdjustmentPercentage);
      }
    } catch {
      /* empty body ok */
    }
    const item = await submitApprovalRequest(actor, id, {
      inventoryAdjustmentPercentage,
    });
    return NextResponse.json({ ok: true, item });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Submit failed." },
      { status: 400 },
    );
  }
}
