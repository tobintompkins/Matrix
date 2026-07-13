import { NextResponse } from "next/server";

/** Lightweight health check for Field connectivity service. */
export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: "matrix-field",
      ts: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
