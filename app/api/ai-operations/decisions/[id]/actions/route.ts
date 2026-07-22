import { NextRequest, NextResponse } from "next/server";
import { forbidUnlessAi, resolveAiActor } from "@/lib/ai/auth";
import { hasMatrixPermission } from "@/lib/auth/permissions";
import type { MatrixPermission } from "@/lib/auth/types";
import {
  approveDecision,
  assignDecision,
  cancelDecision,
  completeDecision,
  deferDecision,
  recordDecisionFeedback,
  rejectDecision,
  serializeDecision,
  startDecision,
} from "@/lib/decision-engine";

export const dynamic = "force-dynamic";

type Action =
  | "approve"
  | "reject"
  | "defer"
  | "assign"
  | "start"
  | "complete"
  | "cancel"
  | "feedback";

const ACTION_PERMISSION: Record<Action, MatrixPermission> = {
  approve: "APPROVE_DECISIONS",
  reject: "REVIEW_DECISIONS",
  defer: "REVIEW_DECISIONS",
  assign: "ASSIGN_DECISIONS",
  start: "COMPLETE_DECISIONS",
  complete: "COMPLETE_DECISIONS",
  cancel: "REVIEW_DECISIONS",
  feedback: "COMPLETE_DECISIONS",
};

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const actor = await resolveAiActor();
  const { id } = await ctx.params;
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  const action = String(body.action || "") as Action;
  if (!ACTION_PERMISSION[action]) {
    return NextResponse.json(
      { ok: false, error: "Unknown action." },
      { status: 400 },
    );
  }
  const denied = forbidUnlessAi(actor, ACTION_PERMISSION[action]);
  if (denied) return denied;

  const actorInfo = { userId: actor.userId, displayName: actor.displayName };
  let result:
    | { ok: true; decision: unknown }
    | { ok: false; error: string };

  switch (action) {
    case "approve":
      result = await approveDecision({
        decisionId: id,
        actor: actorInfo,
        notes: typeof body.notes === "string" ? body.notes : null,
      });
      break;
    case "reject":
      result = await rejectDecision({
        decisionId: id,
        actor: actorInfo,
        reason: String(body.reason || ""),
      });
      break;
    case "defer":
      result = await deferDecision({
        decisionId: id,
        actor: actorInfo,
        deferredUntil: String(body.deferredUntil || ""),
        reason: String(body.reason || ""),
      });
      break;
    case "assign":
      result = await assignDecision({
        decisionId: id,
        actor: actorInfo,
        assignedToUserId: String(body.assignedToUserId || ""),
        technicianId:
          typeof body.technicianId === "string" ? body.technicianId : null,
        notes: typeof body.notes === "string" ? body.notes : null,
      });
      break;
    case "start":
      result = await startDecision({ decisionId: id, actor: actorInfo });
      break;
    case "complete":
      result = await completeDecision({
        decisionId: id,
        actor: actorInfo,
        completionNotes:
          typeof body.completionNotes === "string" ? body.completionNotes : null,
        outcomeUseful:
          typeof body.outcomeUseful === "boolean" ? body.outcomeUseful : null,
        outcomeConfirmed:
          typeof body.outcomeConfirmed === "boolean"
            ? body.outcomeConfirmed
            : null,
        outcomeDowntimeAvoided:
          typeof body.outcomeDowntimeAvoided === "boolean"
            ? body.outcomeDowntimeAvoided
            : null,
        outcomeActualLaborMinutes:
          typeof body.outcomeActualLaborMinutes === "number"
            ? body.outcomeActualLaborMinutes
            : null,
        outcomeActualCost:
          typeof body.outcomeActualCost === "number"
            ? body.outcomeActualCost
            : null,
        usefulRating:
          typeof body.usefulRating === "number" ? body.usefulRating : null,
      });
      break;
    case "cancel":
      result = await cancelDecision({
        decisionId: id,
        actor: actorInfo,
        reason: typeof body.reason === "string" ? body.reason : null,
      });
      break;
    case "feedback":
      result = await recordDecisionFeedback({
        decisionId: id,
        actor: actorInfo,
        usefulRating:
          typeof body.usefulRating === "number" ? body.usefulRating : null,
        outcomeUseful:
          typeof body.outcomeUseful === "boolean" ? body.outcomeUseful : null,
        outcomeConfirmed:
          typeof body.outcomeConfirmed === "boolean"
            ? body.outcomeConfirmed
            : null,
        outcomeDowntimeAvoided:
          typeof body.outcomeDowntimeAvoided === "boolean"
            ? body.outcomeDowntimeAvoided
            : null,
        notes: typeof body.notes === "string" ? body.notes : null,
      });
      break;
    default:
      return NextResponse.json(
        { ok: false, error: "Unsupported action." },
        { status: 400 },
      );
  }

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 400 },
    );
  }

  const includeCosts = hasMatrixPermission(actor.role, "VIEW_DECISION_COSTS");
  return NextResponse.json({
    ok: true,
    decision: serializeDecision(
      result.decision as Parameters<typeof serializeDecision>[0],
      { includeCosts },
    ),
    note:
      action === "approve"
        ? "Approval recorded. High-impact operational changes were not auto-executed — use existing Matrix workflows to follow through."
        : undefined,
  });
}
