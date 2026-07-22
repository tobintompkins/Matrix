import { NextResponse } from "next/server";
import { forbidUnless, resolveAdminActor } from "@/lib/admin/auth";
import { writeAdminAudit } from "@/lib/admin/repository";
import { prisma } from "@/lib/db/prisma";
import { listDataQualityRules, ensureSystemRulesSeeded } from "@/lib/data-quality/rules";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "VIEW_DATA_QUALITY_CENTER");
  if (denied) return denied;
  const rows = await listDataQualityRules(actor.organizationId);
  return NextResponse.json({
    ok: true,
    items: rows.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      description: r.description,
      module: r.module,
      entityType: r.entityType,
      ruleType: r.ruleType,
      severity: r.severity,
      isActive: r.isActive,
      isSystemRule: r.isSystemRule,
      priority: r.priority,
    })),
  });
}

export async function POST(req: Request) {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "CREATE_DATA_QUALITY_RULE");
  if (denied) return denied;
  await ensureSystemRulesSeeded(actor.organizationId);
  const body = (await req.json()) as {
    code?: string;
    name?: string;
    description?: string;
    module?: string;
    entityType?: string;
    ruleType?: string;
    severity?: string;
    configuration?: Record<string, unknown>;
  };
  if (!body.code || !body.name || !body.module || !body.entityType || !body.ruleType) {
    return NextResponse.json({ ok: false, error: "Missing required fields." }, { status: 400 });
  }
  if (!/^[A-Z][A-Z0-9_]{2,63}$/.test(body.code)) {
    return NextResponse.json({ ok: false, error: "Invalid rule code." }, { status: 400 });
  }
  const created = await prisma.dataQualityRule.create({
    data: {
      organizationId: actor.organizationId,
      code: body.code,
      name: body.name.slice(0, 200),
      description: (body.description ?? "").slice(0, 2000),
      module: body.module,
      entityType: body.entityType,
      ruleType: body.ruleType,
      severity: body.severity ?? "MEDIUM",
      isActive: true,
      isSystemRule: false,
      configurationJson: JSON.stringify(body.configuration ?? {}),
      createdByUserId: actor.userId,
      updatedByUserId: actor.userId,
    },
  });
  await writeAdminAudit({
    organizationId: actor.organizationId,
    actorId: actor.userId,
    action: "DATA_QUALITY_RULE_CREATED",
    entityType: "DataQualityRule",
    entityId: created.id,
  });
  return NextResponse.json({ ok: true, id: created.id });
}
