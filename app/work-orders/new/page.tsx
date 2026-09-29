import MatrixShell from "../../components/MatrixShell";
import WorkflowPageShell from "../../components/WorkflowPageShell";
import MatrixAuthGuard from "../../components/MatrixAuthGuard";
import { MatrixPageHeader } from "../../components/ui";
import WorkOrderCreateForm from "../WorkOrderCreateForm";
import { isServerOfficeWorkOrdersEnabled } from "@/lib/work-orders/server-office-read";

export default function NewWorkOrderPage() {
  const serverOfficeQueueEnabled = isServerOfficeWorkOrdersEnabled();
  return (
    <MatrixShell title="New Work Order" activePath="/work-orders">
      <WorkflowPageShell current="service-ticket">
        <MatrixAuthGuard requiredPermissions={["CREATE_WORK_ORDER"]}>
          <MatrixPageHeader
            title="New Work Order"
            subtitle="Create a service, PM, install, or customer visit work order."
            breadcrumbs={["Matrix", "Work Orders", "New"]}
          />
          <WorkOrderCreateForm serverOfficeQueueEnabled={serverOfficeQueueEnabled} />
        </MatrixAuthGuard>
      </WorkflowPageShell>
    </MatrixShell>
  );
}
