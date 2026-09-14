import { prisma } from "@/lib/db/prisma";
import type { MatrixUserProfile } from "@/lib/auth/types";
import { buildFieldSyncReceipt, type AuthorizedFieldSyncOperation } from "./sync-receipt";

export type { AuthorizedFieldSyncOperation } from "./sync-receipt";

/**
 * Store an immutable server receipt before a later processor applies the
 * business change. operationId makes retries safe and prevents duplicates.
 */
export async function recordFieldSyncReceipt(
  profile: MatrixUserProfile,
  userId: string,
  operation: AuthorizedFieldSyncOperation,
): Promise<{ duplicate: boolean }> {
  const receipt = buildFieldSyncReceipt(profile, userId, operation);
  const existing = await prisma.offlineOperation.findUnique({
    where: { operationId: receipt.operationId },
    select: { id: true },
  });
  if (existing) return { duplicate: true };

  try {
    await prisma.offlineOperation.create({
      data: {
        operationId: receipt.operationId,
        type: receipt.type,
        status: "RECEIVED",
        userId: receipt.userId,
        technicianName: receipt.technicianName,
        workOrderId: receipt.workOrderId,
        printerId: receipt.printerId,
        payload: receipt.payload,
        dependsOnJson: receipt.dependsOnJson,
      },
    });
    return { duplicate: false };
  } catch (error) {
    // A concurrent retry may win the unique operationId race.
    const raced = await prisma.offlineOperation.findUnique({
      where: { operationId: receipt.operationId },
      select: { id: true },
    });
    if (raced) return { duplicate: true };
    throw error;
  }
}

/** Manager-only safe summary. Payloads are intentionally never returned. */
export async function listRecentFieldSyncReceipts(limit = 50) {
  const rows = await prisma.offlineOperation.findMany({
    orderBy: { createdAt: "desc" },
    take: Math.max(1, Math.min(limit, 100)),
    select: {
      operationId: true,
      type: true,
      status: true,
      technicianName: true,
      workOrderId: true,
      printerId: true,
      createdAt: true,
      updatedAt: true,
      lastError: true,
    },
  });
  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}
