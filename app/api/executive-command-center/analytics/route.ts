import { NextRequest, NextResponse } from "next/server";
import { forbidUnlessAi, resolveAiActor } from "@/lib/ai/auth";
import { getExecutiveAnalytics } from "@/lib/executive-command-center";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const actor = await resolveAiActor();
  const deniedAnalytics = forbidUnlessAi(actor, "VIEW_EXECUTIVE_ANALYTICS");
  if (deniedAnalytics) {
    const deniedEcc = forbidUnlessAi(actor, "VIEW_EXECUTIVE_COMMAND_CENTER");
    if (deniedEcc) return deniedEcc;
  }

  try {
    const range = req.nextUrl.searchParams.get("range");
    const analytics = await getExecutiveAnalytics({
      organizationId: DEFAULT_ORG_ID,
      range,
    });
    return NextResponse.json({ ok: true, analytics });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "Failed to load analytics.",
      },
      { status: 500 },
    );
  }
}
