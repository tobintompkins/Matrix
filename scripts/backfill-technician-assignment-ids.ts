import { prisma } from "../lib/db/prisma";

const apply = process.argv.includes("--apply");
const rawMapping = process.env.MATRIX_TECHNICIAN_ID_MAP;

function readMapping(raw: string | undefined): Record<string, string> {
  if (!raw) throw new Error("Set MATRIX_TECHNICIAN_ID_MAP to a JSON object of technician name to Clerk user ID.");
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw new Error("MATRIX_TECHNICIAN_ID_MAP must be a JSON object.");
  const output: Record<string, string> = {};
  for (const [name, userId] of Object.entries(parsed)) {
    if (typeof userId !== "string" || !name.trim() || !userId.trim()) throw new Error("Every mapping needs a name and user ID.");
    output[name.trim().toLocaleLowerCase()] = userId.trim();
  }
  return output;
}

async function main() {
  const mapping = readMapping(rawMapping);
  const candidates = await prisma.workOrder.findMany({
    where: { assignedTechnician: { not: null }, assignedTechnicianId: null },
    select: { id: true, workOrderNumber: true, assignedTechnician: true },
    orderBy: { updatedAt: "desc" },
  });
  const ready = candidates.flatMap((workOrder) => {
    const name = workOrder.assignedTechnician?.trim() ?? "";
    const technicianId = mapping[name.toLocaleLowerCase()];
    return technicianId ? [{ ...workOrder, technicianId }] : [];
  });
  const unresolved = candidates.length - ready.length;

  console.log(`Technician ID backfill ${apply ? "apply" : "dry run"}: ${ready.length} ready, ${unresolved} unresolved.`);
  for (const item of ready) console.log(`${item.workOrderNumber} · ${item.assignedTechnician} → ${item.technicianId}`);
  if (!apply) {
    console.log("No data changed. Review this output, then rerun with --apply only after manager approval.");
    return;
  }

  await prisma.$transaction(ready.map((item) => prisma.workOrder.update({
    where: { id: item.id },
    data: { assignedTechnicianId: item.technicianId },
  })));
  console.log(`Applied durable primary technician IDs to ${ready.length} work order(s).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());
