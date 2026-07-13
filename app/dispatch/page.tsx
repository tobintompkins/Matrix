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
          title="Enterprise Dispatch Center"
          subtitle="Assign, schedule, and track service tickets with SLA, workload, and repeat-failure intelligence."
          breadcrumbs={["Matrix", "Service Platform", "Dispatch"]}
          actions={
            <div className="flex flex-wrap gap-2">
              <MatrixButton href="/service-calls/new" variant="primary" size="md">
                New Service Ticket
              </MatrixButton>
              <MatrixButton href="/service-calls" variant="secondary" size="md">
                All tickets
              </MatrixButton>
              <MatrixButton href="/field/work" variant="secondary" size="md">
                Tech mobile
              </MatrixButton>
            </div>
          }
        />
        <DispatchBoardPanel />
      </WorkflowPageShell>
    </MatrixShell>
  );
}
