import ContextPanel from "../components/ContextPanel";
import MatrixShell from "../components/MatrixShell";
import WorkflowPageShell from "../components/WorkflowPageShell";
import DiagramPartDetailPanel from "./DiagramPartDetailPanel";

export default function DiagramPartDetailPage() {
  return (
    <MatrixShell title="Diagram Part Detail" activePath="/diagram-part-detail">
      <WorkflowPageShell current="order-parts">
        <ContextPanel className="mb-6" />
        <DiagramPartDetailPanel />
      </WorkflowPageShell>
    </MatrixShell>
  );
}
