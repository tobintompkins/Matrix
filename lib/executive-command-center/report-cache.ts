/**
 * Patch 51A.5 Part 3 — Short-lived report cache (memory + Prisma).
 */

import { prisma } from "@/lib/db/prisma";

const memory = new Map<string, { expiresAt: number; payload: unknown }>();

function memKey(organizationId: string, cacheKey: string) {
  return `${organizationId}::${cacheKey}`;
}

export async function getCachedReport<T>(
  organizationId: string,
  cacheKey: string,
): Promise<T | null> {
  const key = memKey(organizationId, cacheKey);
  const hit = memory.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    return hit.payload as T;
  }
  if (hit) memory.delete(key);

  try {
    const row = await prisma.executiveReportCache.findUnique({
      where: {
        organizationId_cacheKey: { organizationId, cacheKey },
      },
    });
    if (!row) return null;
    if (row.expiresAt.getTime() <= Date.now()) {
      await prisma.executiveReportCache
        .delete({ where: { id: row.id } })
        .catch(() => undefined);
      return null;
    }
    const parsed = JSON.parse(row.payloadJson) as T;
    memory.set(key, {
      expiresAt: row.expiresAt.getTime(),
      payload: parsed,
    });
    return parsed;
  } catch {
    return null;
  }
}

export async function setCachedReport(
  organizationId: string,
  cacheKey: string,
  payload: unknown,
  ttlSeconds = 60,
): Promise<void> {
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
  memory.set(memKey(organizationId, cacheKey), {
    expiresAt: expiresAt.getTime(),
    payload,
  });
  try {
    await prisma.executiveReportCache.upsert({
      where: {
        organizationId_cacheKey: { organizationId, cacheKey },
      },
      create: {
        organizationId,
        cacheKey,
        payloadJson: JSON.stringify(payload),
        expiresAt,
      },
      update: {
        payloadJson: JSON.stringify(payload),
        expiresAt,
      },
    });
  } catch {
    /* DB cache is best-effort */
  }
}
