import { prisma } from "@/lib/db/prisma";
import { isServerFieldWorkOrderBridgeEnabled } from "./server-field-repository";

export type ServerFieldWorkOrderIssue = {
  workOrderId: string;
  workOrderNumber: string;
  title: string;
  issues: string[];
};

export type ServerFieldWorkOrderReadiness = {
  bridgeEnabled: boolean;
  totalWorkOrders: number;
  readyWorkOrders: number;
  blockingWorkOrders: number;
  readyToEnable: boolean;
  issues: ServerFieldWorkOrderIssue[];
};

/** Read-only preflight for the durable Field work-order bridge. */
export async function getServerFieldWorkOrderReadiness(): Promise<ServerFieldWorkOrderReadiness> {
  const orders = await prisma.workOrder.findMany({
    select: {
      id: true,
      workOrderNumber: true,
      title: true,
      assignedTechnician: true,
      scheduledStart: true,
      status: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  const issues = orders.flatMap((order) => {
    const problems: string[] = [];
    if (!order.assignedTechnician?.trim()) problems.push("No assigned technician");
    if (!order.scheduledStart) problems.push("No scheduled start");
    if (!order.status?.trim()) problems.push("No status");
    if (!order.title.trim()) problems.push("No job title");
    return problems.length
      ? [{
          workOrderId: order.id,
          workOrderNumber: order.workOrderNumber,
          title: order.title || "Untitled work order",
          issues: problems,
        }]
      : [];
  });

  const blockingWorkOrders = issues.length;
  return {
    bridgeEnabled: isServerFieldWorkOrderBridgeEnabled(),
    totalWorkOrders: orders.length,
    readyWorkOrders: orders.length - blockingWorkOrders,
    blockingWorkOrders,
    readyToEnable: orders.length > 0 && blockingWorkOrders === 0,
    issues: issues.slice(0, 25),
  };
}
