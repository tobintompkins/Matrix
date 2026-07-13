import { NextResponse } from "next/server";

/**
 * Batch sync endpoint foundation.
 * Client still applies via local sync engine against sessionStorage repos in this patch;
 * this route validates payload shape and returns idempotent acknowledgements for future DB wiring.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const ops = (body as { operations?: unknown }).operations;
  if (!Array.isArray(ops)) {
    return NextResponse.json(
      { ok: false, error: "operations array required" },
      { status: 400 },
    );
  }

  const results = ops.map((raw) => {
    const op = raw as { operationId?: string; type?: string };
    if (!op.operationId || !op.type) {
      return {
        operationId: op.operationId ?? null,
        status: "FAILED",
        error: "operationId and type required",
      };
    }
    return {
      operationId: op.operationId,
      status: "ACCEPTED",
      duplicate: false,
    };
  });

  return NextResponse.json({
    ok: true,
    results,
    receivedAt: new Date().toISOString(),
  });
}
