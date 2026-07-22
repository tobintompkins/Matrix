import { NextResponse } from "next/server";
import { forbidUnless, resolveAdminActor } from "@/lib/admin/auth";
import { previewDataQualityMerge } from "@/lib/data-quality/merge";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "MERGE_DUPLICATE_RECORDS");
  if (denied) return denied;
  const body = (await req.json()) as {
    entityType?: string;
    masterRecordId?: string;
    duplicateRecordId?: string;
  };
  if (!body.entityType || !body.masterRecordId || !body.duplicateRecordId) {
    return NextResponse.json(
      { ok: false, error: "entityType, masterRecordId, and duplicateRecordId are required." },
      { status: 400 },
    );
  }
  const result = await previewDataQualityMerge({
    actor,
    entityType: body.entityType,
    masterRecordId: body.masterRecordId,
    duplicateRecordId: body.duplicateRecordId,
  });
  if (!result.ok) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result);
}
