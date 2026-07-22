import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import {
  evaluateSingleMachine,
  runPredictiveBatch,
} from "@/lib/predictive-maintenance/evaluate";
import {
  getOrCreatePredictiveSettings,
  settingsToDefaults,
} from "@/lib/predictive-maintenance/settings";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";

export const dynamic = "force-dynamic";

/**
 * Secret-protected scheduled predictive evaluation (Railway/Vercel cron).
 * Header: Authorization: Bearer $PREDICTIVE_MAINTENANCE_CRON_SECRET
 * or x-predictive-maintenance-cron-secret
 */
export async function POST(request: Request) {
  const secret = process.env.PREDICTIVE_MAINTENANCE_CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      {
        ok: false,
        error: "PREDICTIVE_MAINTENANCE_CRON_SECRET is not configured.",
      },
      { status: 503 },
    );
  }
  const header =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    request.headers.get("x-predictive-maintenance-cron-secret");
  if (header !== secret) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const organizationId = DEFAULT_ORG_ID;
  const settings = settingsToDefaults(
    await getOrCreatePredictiveSettings(organizationId),
  );
  if (!settings.enabled) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "Predictive maintenance disabled",
    });
  }

  // Process queued re-evaluation requests first (event-driven outbox)
  const pending = await prisma.aiOpsAutomationEvent.findMany({
    where: {
      eventType: "predictive.reevaluate_requested",
      status: "PENDING",
      availableAt: { lte: new Date() },
    },
    orderBy: { createdAt: "asc" },
    take: 25,
  });

  let reevaluated = 0;
  for (const event of pending) {
    let machineId = event.entityId;
    try {
      const payload = JSON.parse(event.payloadJson) as { machineId?: string };
      machineId = payload.machineId ?? event.entityId;
    } catch {
      /* use entityId */
    }
    const result = await evaluateSingleMachine({
      machineId,
      organizationId,
      runType: "EVENT_TRIGGERED",
    });
    await prisma.aiOpsAutomationEvent.update({
      where: { id: event.id },
      data: {
        status: result.ok ? "PROCESSED" : "FAILED",
        processedAt: new Date(),
        lastError: result.ok ? null : result.error,
        attempts: { increment: 1 },
      },
    });
    if (result.ok) reevaluated += 1;
  }

  let scheduledRun = null;
  if (settings.scheduledEvaluationEnabled) {
    scheduledRun = await runPredictiveBatch({
      organizationId,
      runType: "SCHEDULED",
      batchSize: 50,
    });
  }

  return NextResponse.json({
    ok: true,
    reevaluated,
    pendingProcessed: pending.length,
    scheduledRun,
  });
}
