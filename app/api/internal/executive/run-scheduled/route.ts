import { NextResponse } from "next/server";
import { runDueExecutiveSchedules } from "@/lib/executive-command-center/schedules";
import { syncExecutiveAlerts } from "@/lib/executive-command-center/alerts";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";

export const dynamic = "force-dynamic";

/**
 * Cron-compatible executive scheduler (Railway / external cron).
 * Header: Authorization: Bearer $EXECUTIVE_CRON_SECRET
 * or x-executive-cron-secret
 *
 * Falls back to AUTOMATION_CRON_SECRET if EXECUTIVE_CRON_SECRET is unset,
 * so one secret can drive both automation and executive jobs when desired.
 *
 * Not claimed active unless the secret is configured in the deployment.
 */
export async function POST(request: Request) {
  const secret =
    process.env.EXECUTIVE_CRON_SECRET || process.env.AUTOMATION_CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "EXECUTIVE_CRON_SECRET (or AUTOMATION_CRON_SECRET) is not configured.",
        active: false,
      },
      { status: 503 },
    );
  }
  const header =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    request.headers.get("x-executive-cron-secret");
  if (header !== secret) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const alerts = await syncExecutiveAlerts(DEFAULT_ORG_ID);
  const schedules = await runDueExecutiveSchedules(DEFAULT_ORG_ID);
  return NextResponse.json({
    ok: true,
    active: true,
    alerts,
    schedules,
  });
}
