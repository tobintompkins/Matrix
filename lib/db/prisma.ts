/**
 * Prisma client singleton for Next.js (Patch 45).
 *
 * Prisma 7 requires a driver adapter for SQLite.
 * Import path (verified after `npx prisma generate`):
 *   import { PrismaClient } from "@/lib/generated/prisma/client"
 */

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/lib/generated/prisma/client";
import path from "node:path";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function resolveSqliteUrl(): string {
  const raw = process.env.DATABASE_URL ?? "file:./dev.db";
  if (!raw.startsWith("file:")) return raw;

  const filePart = raw.slice("file:".length);
  if (path.isAbsolute(filePart)) return raw;

  // Prisma CLI with DATABASE_URL=file:./dev.db resolves relative to cwd.
  return `file:${path.resolve(process.cwd(), filePart)}`;
}

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaBetterSqlite3({ url: resolveSqliteUrl() });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export { PrismaClient };
export default prisma;
