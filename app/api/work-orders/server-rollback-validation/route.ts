import { NextResponse } from "next/server";
import { requireMatrixPermission } from "@/lib/auth/server";
import { compareBrowserWorkOrdersToServer } from "@/lib/work-orders/office-queue-compare-service";
import { evaluateOfficeRolloutGuard } from "@/lib/work-orders/office-rollout-guard";
import {
  browserSnapshotMatchesWorkOrders,
  captureBrowserQueueSnapshot,
  validateOfficeBrowserRollback,
  type BrowserQueueSnapshot,
} from "@/lib/work-orders/office-queue-rollback";
import { getConfiguredOfficePilotManager, matchesOfficePilotManager } from "@/lib/work-orders/office-pilot";
import { getOfficePilotSignoffContext } from "@/lib/work-orders/office-pilot-signoff";
import { isServerOfficeWorkOrdersEnabled } from "@/lib/work-orders/server-office-read";
import type { WorkOrder } from "@/lib/work-orders/types";

/** Manager-only read-only validation that the browser queue rollback path stays intact. */
export async function POST(request: Request) {
  const authResult = await requireMatrixPermission("MANAGE_WORK_ORDERS");
  if (!authResult.ok) return authResult.response;

  let body: { browserWorkOrders?: unknown; snapshotBefore?: unknown };
  try {
    body = (await request.json()) as { browserWorkOrders?: unknown; snapshotBefore?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(body.browserWorkOrders) || body.browserWorkOrders.length > 500) {
    return NextResponse.json(
      { ok: false, error: "Provide up to 500 browser work orders to validate rollback." },
      { status: 400 },
    );
  }

  const browserWorkOrders = body.browserWorkOrders as WorkOrder[];
  const snapshotBefore = normalizeSnapshot(body.snapshotBefore, browserWorkOrders);
  if (!snapshotBefore) {
    return NextResponse.json(
      { ok: false, error: "Provide snapshotBefore matching the browser work orders." },
      { status: 400 },
    );
  }

  const comparison = await compareBrowserWorkOrdersToServer(browserWorkOrders);
  const guard = evaluateOfficeRolloutGuard(comparison);
  const officeFlagEnabled = isServerOfficeWorkOrdersEnabled();
  const pilotContext = await getOfficePilotSignoffContext();
  const configuredPilotManager = getConfiguredOfficePilotManager();

  const validation = validateOfficeBrowserRollback({
    officeFlagEnabled,
    guardReady: guard.readyToEnableOfficeFlag,
    guardBlockedReasons: guard.readyToEnableOfficeFlag ? [] : guard.reasons,
    snapshotBefore,
    snapshotAfter: snapshotBefore,
    snapshotMatchesRequest: browserSnapshotMatchesWorkOrders(snapshotBefore, browserWorkOrders),
    pilotSignoffStatus: pilotContext.signoff.status,
    isNamedPilotManager: configuredPilotManager
      ? matchesOfficePilotManager(authResult.profile, configuredPilotManager)
      : false,
    pilotManagerConfigured: Boolean(configuredPilotManager),
    configuredPilotManager,
  });

  return NextResponse.json({
    ok: true,
    officeFlagEnabled,
    guard,
    validation,
  });
}

function normalizeSnapshot(
  raw: unknown,
  browserWorkOrders: WorkOrder[],
): BrowserQueueSnapshot | null {
  if (!raw || typeof raw !== "object") {
    return captureBrowserQueueSnapshot(browserWorkOrders);
  }
  const candidate = raw as Partial<BrowserQueueSnapshot>;
  if (
    typeof candidate.recordCount !== "number" ||
    typeof candidate.fingerprint !== "string" ||
    !Array.isArray(candidate.orderIds)
  ) {
    return null;
  }
  return {
    recordCount: candidate.recordCount,
    fingerprint: candidate.fingerprint,
    orderIds: candidate.orderIds.map(String),
  };
}
