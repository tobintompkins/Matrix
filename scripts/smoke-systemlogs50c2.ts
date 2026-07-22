import { prisma } from "../lib/db/prisma";

async function main() {
  console.log("hasSystemLogSetting", typeof prisma.systemLogSetting);
  console.log("auditCount", await prisma.auditLog.count());
  const row = await prisma.systemLogSetting.findFirst();
  console.log("settingRow", row);
}

main()
  .catch((e) => {
    console.error("FAIL", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
