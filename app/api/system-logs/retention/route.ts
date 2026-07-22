import { NextResponse } from "next/server";
import { forbidUnless, resolveAdminActor } from "@/lib/admin/auth";
import { writeAdminAudit } from "@/lib/admin/repository";
import {
  getRetentionPolicies,
  updateRetentionPolicy,
} from "@/lib/system-logs/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "VIEW_SYSTEM_LOGS");
  if (denied) return denied;
  const policies = await getRetentionPolicies(actor.organizationId);
  return NextResponse.json({
    ok: true,
    policies: policies.map((p) => ({
      retentionClass: p.retentionClass,
      days: p.days,
      updatedAt: p.updatedAt.toISOString(),
    })),
    note: "Retention settings are stored, but automated cleanup is not running because no scheduler is installed. Changing retention does not immediately delete logs.",
  });
}

export async function PATCH(req: Request) {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "MANAGE_LOG_RETENTION");
  if (denied) return denied;
  const body = (await req.json()) as {
    retentionClass?: string;
    days?: number;
    confirm?: boolean;
  };
  if (!body.confirm) {
    return NextResponse.json(
      { ok: false, error: "Confirmation is required." },
      { status: 400 },
    );
  }
  if (!body.retentionClass || body.days == null) {
    return NextResponse.json(
      { ok: false, error: "retentionClass and days are required." },
      { status: 400 },
    );
  }
  try {
    await updateRetentionPolicy({
      organizationId: actor.organizationId,
      retentionClass: body.retentionClass,
      days: body.days,
      actorUserId: actor.userId,
    });
    await writeAdminAudit({
      organizationId: actor.organizationId,
      actorId: actor.userId,
      action: "SYSTEM_LOG_RETENTION_UPDATED",
      entityType: "SystemLogRetentionPolicy",
      entityId: body.retentionClass,
      category: "CONFIGURATION",
      severity: "WARNING",
      outcome: "SUCCESS",
      payload: { days: body.days },
    });
    const policies = await getRetentionPolicies(actor.organizationId);
    return NextResponse.json({
      ok: true,
      policies: policies.map((p) => ({
        retentionClass: p.retentionClass,
        days: p.days,
      })),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Failed." },
      { status: 400 },
    );
  }
}
