import { NextResponse } from "next/server";
import { requireMatrixPermission } from "@/lib/auth/server";
import { hasConfiguredFieldApiIdentity } from "@/lib/field/api-authorization";
import { prisma } from "@/lib/db/prisma";
import { getLatestFieldDeviceVerificationSubmission } from "@/lib/field/device-verification-submission";
import { getLatestFieldReleaseDecision } from "@/lib/field/field-release-decision-audit";
import { buildFieldOperationalReleaseGate } from "@/lib/field/field-operational-release-gate-service";

/** Manager-only advisory Field operational release gate. */
export async function GET() {
  const authResult = await requireMatrixPermission("VIEW_FIELD_ALL_TECHNICIANS");
  if (!authResult.ok) return authResult.response;
  if (!hasConfiguredFieldApiIdentity(authResult.profile)) {
    return NextResponse.json({ ok: false, error: "A configured Matrix role is required." }, { status: 403 });
  }

  const [latestVerification, latestDecision, groups, oldestReceived] = await Promise.all([
    getLatestFieldDeviceVerificationSubmission(),
    getLatestFieldReleaseDecision(),
    prisma.offlineOperation.groupBy({
      by: ["type", "status"],
      where: { status: { in: ["RECEIVED", "APPLIED", "REJECTED"] } },
      _count: { _all: true },
    }),
    prisma.offlineOperation.findFirst({
      where: { status: "RECEIVED" }, orderBy: { createdAt: "asc" }, select: { createdAt: true },
    }),
  ]);

  const gate = buildFieldOperationalReleaseGate({
    latestVerification,
    latestDecision,
    rows: groups.map((group) => ({ type: group.type, status: group.status, count: group._count._all })),
    oldestReceivedAt: oldestReceived?.createdAt ?? null,
  });
  return NextResponse.json({ ok: true, gate });
}
