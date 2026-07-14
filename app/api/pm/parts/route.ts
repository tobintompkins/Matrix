import { NextResponse } from "next/server";
import { findPartByNumber, listCatalog } from "@/lib/inventory";

export const dynamic = "force-dynamic";

/** Lookup parts from existing inventory catalog (no duplicate tables). */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const partNumber = url.searchParams.get("partNumber")?.trim();
    const q = url.searchParams.get("q")?.trim();

    if (partNumber) {
      const part = findPartByNumber(partNumber);
      return NextResponse.json(
        {
          ok: true,
          part: part
            ? {
                partId: part.id,
                partNumber: part.partNumber,
                description: part.description,
              }
            : null,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const catalog = listCatalog(q || undefined, 1, 20);
    return NextResponse.json(
      {
        ok: true,
        items: catalog.items.map((p) => ({
          partId: p.id,
          partNumber: p.partNumber,
          description: p.description,
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
