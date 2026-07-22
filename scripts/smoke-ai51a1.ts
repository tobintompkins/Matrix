import { ensureAiCenterSeeded } from "../lib/ai/seed";
import { aiEngine } from "../services/ai";
import { prisma } from "../lib/db/prisma";

async function main() {
  const seed = await ensureAiCenterSeeded();
  const status = await aiEngine.status("smoke-user");
  const chat = await aiEngine.chat({
    question: "What is Matrix AI status?",
    userId: "smoke-user",
  });
  const rec = await aiEngine.recommendations("smoke-user");
  const metrics = await aiEngine.metricCards("smoke-user");
  console.log(
    JSON.stringify(
      {
        seed,
        status: {
          online: status.online,
          version: status.version,
          confidence: status.confidence,
          responseTime: status.responseTime,
        },
        chat,
        recCount: rec.length,
        metrics,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
