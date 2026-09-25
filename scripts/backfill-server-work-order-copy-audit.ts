import { prisma } from "@/lib/db/prisma";

async function main() {
  const orders = await prisma.workOrder.findMany({
    where: { legacyWorkOrderId: { not: null } },
    select: { id: true, workOrderNumber: true, legacyWorkOrderId: true, createdBy: true },
  });
  let created = 0;
  for (const order of orders) {
    const existing = await prisma.workOrderAuditEntry.findFirst({
      where: { workOrderId: order.id, action: "COPIED_TO_SERVER" },
      select: { id: true },
    });
    if (existing || !order.legacyWorkOrderId) continue;
    await prisma.$transaction([
      prisma.workOrderTimelineEvent.create({
        data: {
          workOrderId: order.id,
          type: "MIGRATED_TO_SERVER",
          title: "Backfilled browser-to-server copy record",
          description: `Prototype work order ${order.workOrderNumber} was copied before audit tracking was enabled.`,
          actor: order.createdBy ?? "Matrix migration",
          newValue: order.legacyWorkOrderId,
        },
      }),
      prisma.workOrderAuditEntry.create({
        data: {
          workOrderId: order.id,
          field: "legacyWorkOrderId",
          previousValue: null,
          newValue: order.legacyWorkOrderId,
          actor: order.createdBy ?? "Matrix migration",
          action: "COPIED_TO_SERVER",
        },
      }),
    ]);
    created += 1;
  }
  console.log(`Server copy audit backfill complete: ${created} record(s) added; ${orders.length - created} already documented.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());

