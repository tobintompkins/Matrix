import { NextResponse } from "next/server";
import { getCustomerPmSummary } from "@/lib/maintenance/pm-prisma-repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const customerName = url.searchParams.get("customerName");
    if (!customerName?.trim()) {
      return NextResponse.json(
        { ok: false, error: "customerName is required." },
        { status: 400 },
      );
    }
    const data = await getCustomerPmSummary(customerName.trim());
    return NextResponse.json(
      { ok: true, data },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
