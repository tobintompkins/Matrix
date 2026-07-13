import ContextPanel from "../components/ContextPanel";
import MatrixShell from "../components/MatrixShell";
import WorkflowPageShell from "../components/WorkflowPageShell";
import AITechnicianPanel from "./AITechnicianPanel";

export default function AITechnicianPage() {
  return (
    <MatrixShell title="AI Technician" activePath="/ai-technician">
      <WorkflowPageShell current="ai-technician">
        <ContextPanel className="mb-6" />
        <AITechnicianPanel />
      </WorkflowPageShell>
    </MatrixShell>
  );
}
