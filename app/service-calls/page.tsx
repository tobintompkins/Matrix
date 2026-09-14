import MatrixShell from "../components/MatrixShell";
import WorkflowPageShell from "../components/WorkflowPageShell";
import MatrixAuthGuard from "../components/MatrixAuthGuard";
import { MatrixButton, MatrixPageHeader } from "../components/ui";
import ServiceCallsDashboardPanel from "./ServiceCallsDashboardPanel";

export default function ServiceCallsPage() {
  return (
    <MatrixShell title="Service Calls" activePath="/service-calls">
      <WorkflowPageShell current="service-ticket">
        <MatrixAuthGuard requiredPermissions={["VIEW_SERVICE_CALLS"]}>
          <MatrixPageHeader
            title="Service Calls"
            subtitle="Create, assign, track, and close printer service calls."
            breadcrumbs={["Matrix", "Workspace", "Service Calls"]}
            actions={
              <div className="flex flex-wrap gap-2">
                <MatrixButton href="/service-calls/new" variant="primary" size="md">
                  New Service Call
                </MatrixButton>
                <MatrixButton href="/dispatch" variant="secondary" size="md">
                  Dispatch Board
                </MatrixButton>
                <MatrixButton href="/dispatch/mobile" variant="secondary" size="md">
                  Field Work
                </MatrixButton>
                <MatrixButton href="/digital-twin" variant="secondary" size="md">
                  Digital Twin
                </MatrixButton>
              </div>
            }
          />
          <ServiceCallsDashboardPanel />
        </MatrixAuthGuard>
      </WorkflowPageShell>
    </MatrixShell>
  );
}
