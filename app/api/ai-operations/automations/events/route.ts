import { NextResponse } from "next/server";
import { forbidUnlessAi, resolveAiActor } from "@/lib/ai/auth";
import { emitAutomationEvent } from "@/lib/automations/emit";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const actor = await resolveAiActor();
  // Allow any authenticated Matrix role that can create service calls to emit;
  // still requires VIEW or CREATE automations OR service-call create path users.
  const deniedAutomations = forbidUnlessAi(actor, "VIEW_AI_AUTOMATIONS");
  const deniedService = forbidUnlessAi(actor, "CREATE_SERVICE_CALL");
  if (deniedAutomations && deniedService) return deniedAutomations;

  const body = (await request.json()) as {
    eventType?: string;
    entityType?: string;
    entityId?: string;
    payload?: Record<string, unknown>;
  };
  if (!body.eventType || !body.entityType || !body.entityId) {
    return NextResponse.json(
      { ok: false, error: "eventType, entityType, and entityId are required." },
      { status: 400 },
    );
  }
  // Only allow known event types from registry keys (no arbitrary injection)
  const allowed = new Set([
    "service_call.created",
    "service_call.updated",
    "service_call.priority_changed",
    "service_call.closed",
    "service_call.overdue",
    "pm.due_soon",
    "pm.overdue",
    "meter.threshold_reached",
    "inventory.low_stock",
    "data_quality.issue_detected",
    "ai.anomaly_detected",
    "ai.recommendation_created",
  ]);
  if (!allowed.has(body.eventType)) {
    return NextResponse.json({ ok: false, error: "Unsupported event type." }, { status: 400 });
  }

  const result = await emitAutomationEvent({
    eventType: body.eventType,
    entityType: body.entityType,
    entityId: body.entityId,
    payload: body.payload ?? {},
    organizationId: DEFAULT_ORG_ID,
  });
  return NextResponse.json({ ok: true, eventId: result.eventId });
}
