import { prisma } from "@/lib/db/prisma";
import {
  ensurePmFleetSeeded,
  getPmDashboardSummary,
} from "@/lib/maintenance/pm-prisma-repository";

async function main() {
  const seeded = await ensurePmFleetSeeded();
  const count = await prisma.machinePmState.count();
  const summary = await getPmDashboardSummary();
  console.log(JSON.stringify({ seeded, count, summary }, null, 2));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
