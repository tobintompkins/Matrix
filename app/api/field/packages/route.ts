import { NextResponse } from "next/server";
import { requireMatrixPermission } from "@/lib/auth/server";
import { canAccessFieldWorkOrder, hasConfiguredFieldApiIdentity } from "@/lib/field/api-authorization";
import { listWorkOrders, getWorkOrder } from "@/lib/work-orders/repository";
import { buildOfflinePackageSnapshot, estimatePackageSize } from "@/lib/field/packages";

/**
 * Offline package retrieval API foundation.
 * Returns selective work-order packages — never the full enterprise DB.
 */
export async function GET(request: Request) {
  const authResult = await requireMatrixPermission("DOWNLOAD_OFFLINE_PACKAGES");
  if (!authResult.ok) return authResult.response;
  if (!hasConfiguredFieldApiIdentity(authResult.profile)) {
    return NextResponse.json({ ok: false, error: "A configured Matrix role is required." }, { status: 403 });
  }
  const { searchParams } = new URL(request.url);
  const workOrderId = searchParams.get("workOrderId");
  const scope = searchParams.get("scope") ?? "one";

  if (scope === "today" || scope === "week") {
    const all = listWorkOrders();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(today);
    end.setDate(end.getDate() + (scope === "today" ? 1 : 7));
    const filtered = all.filter((w) => {
      if (!canAccessFieldWorkOrder(authResult.profile, w)) return false;
      if (!w.scheduledStart) return false;
      const d = new Date(w.scheduledStart);
      return d >= today && d < end;
    });
    const packages = filtered.map((w) => {
      const snapshot = buildOfflinePackageSnapshot(w);
      return {
        workOrderId: w.id,
        workOrderNumber: w.workOrderNumber,
        sizeBytes: estimatePackageSize(snapshot),
        snapshot,
      };
    });
    return NextResponse.json({ ok: true, packages });
  }

  if (!workOrderId) {
    return NextResponse.json(
      { ok: false, error: "workOrderId required" },
      { status: 400 },
    );
  }

  const wo = getWorkOrder(workOrderId);
  if (!wo) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }
  if (!canAccessFieldWorkOrder(authResult.profile, wo)) {
    // A 404 avoids confirming that another technician's work order exists.
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }
  const snapshot = buildOfflinePackageSnapshot(wo);
  return NextResponse.json({
    ok: true,
    package: {
      workOrderId: wo.id,
      workOrderNumber: wo.workOrderNumber,
      sizeBytes: estimatePackageSize(snapshot),
      snapshot,
    },
  });
}
