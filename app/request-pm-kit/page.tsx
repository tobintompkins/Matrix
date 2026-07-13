import ContextPanel from "../components/ContextPanel";
import MatrixShell from "../components/MatrixShell";
import WorkflowPageShell from "../components/WorkflowPageShell";
import PMKitRequestForm from "./PMKitRequestForm";

export default function RequestPMKitPage() {
  return (
    <MatrixShell title="Request PM Kit" activePath="/dashboard">
      <WorkflowPageShell current="start-pm">
        <ContextPanel className="mb-6" />
        <PMKitRequestForm />
      </WorkflowPageShell>
    </MatrixShell>
  );
}
