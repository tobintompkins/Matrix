/**
 * Patch 50A — Approval request numbering (org-scoped, concurrent-safe).
 */

import { prisma } from "@/lib/db/prisma";

export async function nextApprovalRequestNumber(
  organizationId: string,
  year = new Date().getFullYear(),
): Promise<string> {
  const seq = await prisma.$transaction(async (tx) => {
    const existing = await tx.approvalRequestSequence.findUnique({
      where: {
        organizationId_year: { organizationId, year },
      },
    });
    if (!existing) {
      return tx.approvalRequestSequence.create({
        data: { organizationId, year, lastValue: 1 },
      });
    }
    return tx.approvalRequestSequence.update({
      where: { id: existing.id },
      data: { lastValue: existing.lastValue + 1 },
    });
  });

  const padded = String(seq.lastValue).padStart(6, "0");
  return `APR-${year}-${padded}`;
}
