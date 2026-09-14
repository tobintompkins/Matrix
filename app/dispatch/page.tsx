import MatrixShell from "../components/MatrixShell";
import WorkflowPageShell from "../components/WorkflowPageShell";
import {
  MatrixButton,
  MatrixPageHeader,
} from "../components/ui";
import DispatchBoardPanel from "./DispatchBoardPanel";

export default function DispatchPage() {
  return (
    <MatrixShell title="Dispatch Center" activePath="/dispatch">
      <WorkflowPageShell current="service-ticket">
        <MatrixPageHeader
          title="Dispatch Board"
          subtitle="Assign technicians, schedule visits, and track service progress."
          breadcrumbs={["Matrix", "Workspace", "Dispatch"]}
          actions={
            <div className="flex flex-wrap gap-2">
              <MatrixButton href="/service-calls/new" variant="primary" size="md">
                New Service Call
              </MatrixButton>
              <MatrixButton href="/service-calls" variant="secondary" size="md">
                All Service Calls
              </MatrixButton>
              <MatrixButton href="/field/work" variant="secondary" size="md">
                Field Work
              </MatrixButton>
            </div>
          }
        />
        <DispatchBoardPanel />
      </WorkflowPageShell>
    </MatrixShell>
  );
}
