import { NextResponse } from "next/server";
import { runDueScheduledAutomations } from "@/lib/automations/engine/execute-automation";
import { prisma } from "@/lib/db/prisma";
import { processAutomationEvent } from "@/lib/automations/engine/execute-automation";

export const dynamic = "force-dynamic";

/**
 * Secret-protected scheduler endpoint for Railway/Vercel cron.
 * Header: Authorization: Bearer $AUTOMATION_CRON_SECRET
 * or x-automation-cron-secret
 */
export async function POST(request: Request) {
  const secret = process.env.AUTOMATION_CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "AUTOMATION_CRON_SECRET is not configured." },
      { status: 503 },
    );
  }
  const header =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    request.headers.get("x-automation-cron-secret");
  if (header !== secret) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const pending = await prisma.aiOpsAutomationEvent.findMany({
    where: { status: "PENDING", availableAt: { lte: new Date() } },
    orderBy: { createdAt: "asc" },
    take: 25,
  });
  let eventsProcessed = 0;
  for (const e of pending) {
    await processAutomationEvent(e.id);
    eventsProcessed += 1;
  }

  const scheduled = await runDueScheduledAutomations();
  return NextResponse.json({
    ok: true,
    eventsProcessed,
    scheduledRuns: scheduled.length,
    scheduled,
  });
}
