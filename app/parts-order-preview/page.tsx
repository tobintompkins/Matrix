import ContextPanel from "../components/ContextPanel";
import MatrixShell from "../components/MatrixShell";
import WorkflowPageShell from "../components/WorkflowPageShell";
import PartsOrderPreviewForm from "./PartsOrderPreviewForm";

export default function PartsOrderPreviewPage() {
  return (
    <MatrixShell
      title="Order Form Preview"
      activePath="/parts-order-preview"
    >
      <WorkflowPageShell current="order-parts">
        <ContextPanel className="mb-6" />
        <PartsOrderPreviewForm />
      </WorkflowPageShell>
    </MatrixShell>
  );
}
