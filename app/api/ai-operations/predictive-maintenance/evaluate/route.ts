import { NextResponse } from "next/server";
import { forbidUnlessAi, resolveAiActor } from "@/lib/ai/auth";
import {
  evaluateSingleMachine,
  runPredictiveBatch,
} from "@/lib/predictive-maintenance/evaluate";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "RUN_PREDICTIVE_MAINTENANCE");
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as {
    machineId?: string;
    machineIds?: string[];
    batch?: boolean;
  };

  if (body.batch || (body.machineIds && body.machineIds.length)) {
    const run = await runPredictiveBatch({
      organizationId: DEFAULT_ORG_ID,
      machineIds: body.machineIds,
      runType: "MANUAL",
      initiatedById: actor.userId,
      batchSize: 50,
    });
    return NextResponse.json({ ok: true, run });
  }

  if (!body.machineId) {
    return NextResponse.json(
      { ok: false, error: "machineId is required (or pass batch/machineIds)." },
      { status: 400 },
    );
  }

  const result = await evaluateSingleMachine({
    machineId: body.machineId,
    organizationId: DEFAULT_ORG_ID,
    runType: "MANUAL",
    initiatedById: actor.userId,
  });
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json({
    ok: true,
    snapshotId: result.snapshotId,
    result: result.result,
  });
}
