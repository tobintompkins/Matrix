import MatrixShell from "../../components/MatrixShell";
import WorkflowPageShell from "../../components/WorkflowPageShell";
import MatrixAuthGuard from "../../components/MatrixAuthGuard";
import { MatrixPageHeader } from "../../components/ui";
import WorkOrderCreateForm from "../WorkOrderCreateForm";

export default function NewWorkOrderPage() {
  return (
    <MatrixShell title="New Work Order" activePath="/work-orders">
      <WorkflowPageShell current="service-ticket">
        <MatrixAuthGuard requiredPermissions={["CREATE_WORK_ORDER"]}>
          <MatrixPageHeader
            title="New Work Order"
            subtitle="Create a service, PM, install, or customer visit work order."
            breadcrumbs={["Matrix", "Work Orders", "New"]}
          />
          <WorkOrderCreateForm />
        </MatrixAuthGuard>
      </WorkflowPageShell>
    </MatrixShell>
  );
}
