import MatrixShell from "../components/MatrixShell";
import WorkflowPageShell from "../components/WorkflowPageShell";
import ContextPanel from "../components/ContextPanel";
import MatrixAuthGuard from "../components/MatrixAuthGuard";
import AITechnicianPanel from "./AITechnicianPanel";

export default function AITechnicianPage() {
  return (
    <MatrixShell title="Matrix Assist" activePath="/ai-technician">
      <MatrixAuthGuard requiredPermissions={["USE_MATRIX_ASSIST"]}>
        <WorkflowPageShell current="ai-technician">
          <ContextPanel className="mb-6" />
          <AITechnicianPanel />
        </WorkflowPageShell>
      </MatrixAuthGuard>
    </MatrixShell>
  );
}
