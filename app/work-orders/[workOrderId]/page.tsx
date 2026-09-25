import MatrixShell from "../../components/MatrixShell";
import WorkflowPageShell from "../../components/WorkflowPageShell";
import MatrixAuthGuard from "../../components/MatrixAuthGuard";
import { MatrixButton, MatrixPageHeader } from "../../components/ui";
import { isServerOfficeWorkOrdersEnabled } from "@/lib/work-orders/server-office-read";
import WorkOrderDetailPanel from "../WorkOrderDetailPanel";

type Props = {
  params: Promise<{ workOrderId: string }>;
};

export default async function WorkOrderDetailPage({ params }: Props) {
  const { workOrderId } = await params;
  const serverOfficeQueueEnabled = isServerOfficeWorkOrdersEnabled();

  return (
    <MatrixShell title="Work Order" activePath="/work-orders">
      <WorkflowPageShell current="service-ticket">
        <MatrixAuthGuard requiredPermissions={["VIEW_WORK_ORDERS"]}>
          <MatrixPageHeader
            title="Work Order Detail"
            subtitle="Full service workflow, timeline, parts, labor, and signature capture."
            breadcrumbs={["Matrix", "Work Orders", workOrderId]}
            actions={
              <MatrixButton href="/work-orders" variant="secondary" size="md">
                Back to Queue
              </MatrixButton>
            }
          />
          <WorkOrderDetailPanel
            workOrderId={workOrderId}
            serverOfficeQueueEnabled={serverOfficeQueueEnabled}
          />
        </MatrixAuthGuard>
      </WorkflowPageShell>
    </MatrixShell>
  );
}
