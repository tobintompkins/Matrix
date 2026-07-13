import ContextPanel from "../components/ContextPanel";
import MatrixShell from "../components/MatrixShell";
import WorkflowPageShell from "../components/WorkflowPageShell";
import GuidedDiagramOrderingForm from "./GuidedDiagramOrderingForm";

export default function GuidedDiagramOrderingPage() {
  return (
    <MatrixShell
      title="Guided Diagram Ordering"
      activePath="/guided-diagram-ordering"
    >
      <WorkflowPageShell current="order-parts">
        <ContextPanel className="mb-6" />
        <GuidedDiagramOrderingForm />
      </WorkflowPageShell>
    </MatrixShell>
  );
}
