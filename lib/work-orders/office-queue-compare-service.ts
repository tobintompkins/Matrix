import { prisma } from "@/lib/db/prisma";
import {
  compareWorkOrderQueues,
  workOrderToBrowserCompareRow,
  workOrderToServerCompareRow,
  type WorkOrderQueueComparison,
} from "@/lib/work-orders/office-queue-compare";
import { SERVER_OFFICE_WORK_ORDER_LIST_LIMIT } from "@/lib/work-orders/server-office-read";
import type { WorkOrder } from "@/lib/work-orders/types";

export async function compareBrowserWorkOrdersToServer(
  browserWorkOrders: WorkOrder[],
): Promise<WorkOrderQueueComparison> {
  const browserRows = browserWorkOrders.map(workOrderToBrowserCompareRow);
  const serverRows = await prisma.workOrder.findMany({
    select: {
      id: true,
      workOrderNumber: true,
      legacyWorkOrderId: true,
      title: true,
      assignedTechnician: true,
      scheduledStart: true,
      scheduledEnd: true,
      status: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
    take: SERVER_OFFICE_WORK_ORDER_LIST_LIMIT,
  });

  return compareWorkOrderQueues(browserRows, serverRows.map(workOrderToServerCompareRow));
}
