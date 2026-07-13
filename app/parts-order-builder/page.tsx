import ContextPanel from "../components/ContextPanel";
import MatrixShell from "../components/MatrixShell";
import WorkflowPageShell from "../components/WorkflowPageShell";
import PartsOrderBuilderForm from "./PartsOrderBuilderForm";

export default function PartsOrderBuilderPage() {
  return (
    <MatrixShell
      title="Parts Order Builder"
      activePath="/parts-order-builder"
    >
      <WorkflowPageShell current="order-parts">
        <ContextPanel className="mb-6" />
        <PartsOrderBuilderForm />
      </WorkflowPageShell>
    </MatrixShell>
  );
}
