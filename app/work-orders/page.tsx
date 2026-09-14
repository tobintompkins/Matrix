import MatrixShell from "../components/MatrixShell";
import WorkflowPageShell from "../components/WorkflowPageShell";
import MatrixAuthGuard from "../components/MatrixAuthGuard";
import { MatrixButton, MatrixPageHeader } from "../components/ui";
import WorkOrdersDashboardPanel from "./WorkOrdersDashboardPanel";

export default function WorkOrdersPage() {
  return (
    <MatrixShell title="Work Orders" activePath="/work-orders">
      <WorkflowPageShell current="service-ticket">
        <MatrixAuthGuard requiredPermissions={["VIEW_WORK_ORDERS"]}>
          <MatrixPageHeader
            title="Work Orders"
            subtitle="Track service, PM, installs, and customer visits."
            breadcrumbs={["Matrix", "Workspace", "Work Orders"]}
            actions={
              <div className="flex flex-wrap gap-2">
                <MatrixButton href="/work-orders/new" variant="primary" size="md">
                  New Work Order
                </MatrixButton>
                <MatrixButton href="/service-calls" variant="secondary" size="md">
                  Service Calls
                </MatrixButton>
              </div>
            }
          />
          <WorkOrdersDashboardPanel />
        </MatrixAuthGuard>
      </WorkflowPageShell>
    </MatrixShell>
  );
}
