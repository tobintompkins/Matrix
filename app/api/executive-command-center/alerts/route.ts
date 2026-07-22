import { NextRequest, NextResponse } from "next/server";
import { forbidUnlessAi, resolveAiActor } from "@/lib/ai/auth";
import {
  listExecutiveAlerts,
  syncExecutiveAlerts,
  acknowledgeExecutiveAlert,
  resolveExecutiveAlert,
} from "@/lib/executive-command-center/alerts";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "VIEW_EXECUTIVE_COMMAND_CENTER");
  if (denied) return denied;

  const status = req.nextUrl.searchParams.get("status") || undefined;
  const page = Number(req.nextUrl.searchParams.get("page") || "1");
  if (req.nextUrl.searchParams.get("refresh") === "1") {
    await syncExecutiveAlerts(DEFAULT_ORG_ID);
  }

  const result = await listExecutiveAlerts({
    organizationId: DEFAULT_ORG_ID,
    status,
    page,
  });
  return NextResponse.json({
    ok: true,
    ...result,
    items: result.items.map((a) => ({
      ...a,
      detectedAt: a.detectedAt.toISOString(),
      acknowledgedAt: a.acknowledgedAt?.toISOString() ?? null,
      resolvedAt: a.resolvedAt?.toISOString() ?? null,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    })),
  });
}

export async function POST(req: NextRequest) {
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "MANAGE_EXECUTIVE_ALERTS");
  if (denied) return denied;

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  if (body.action === "sync") {
    const result = await syncExecutiveAlerts(DEFAULT_ORG_ID);
    return NextResponse.json({ ok: true, ...result });
  }

  if (body.action === "acknowledge" && typeof body.id === "string") {
    const item = await acknowledgeExecutiveAlert({
      id: body.id,
      actorId: actor.userId,
    });
    if (!item) {
      return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, item });
  }

  if (
    (body.action === "resolve" || body.action === "dismiss") &&
    typeof body.id === "string"
  ) {
    const item = await resolveExecutiveAlert({
      id: body.id,
      actorId: actor.userId,
      note: typeof body.note === "string" ? body.note : undefined,
      dismiss: body.action === "dismiss",
    });
    if (!item) {
      return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, item });
  }

  return NextResponse.json(
    { ok: false, error: "Unknown action." },
    { status: 400 },
  );
}
