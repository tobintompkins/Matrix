import { NextResponse } from "next/server";
import { isServerOfficeWorkOrdersEnabled } from "@/lib/work-orders/server-office-read";
import type { ServerWriteResult } from "@/lib/work-orders/server-office-write";
import type { MatrixUserProfile } from "@/lib/auth/types";

export function officeActor(profile: MatrixUserProfile): string {
  return profile.displayName?.trim() || profile.userId;
}

export function officeWriteJson(result: ServerWriteResult) {
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }
  return NextResponse.json({
    ok: true,
    officeFlagEnabled: isServerOfficeWorkOrdersEnabled(),
    workOrder: result.workOrder,
  });
}
