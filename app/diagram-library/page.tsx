import ContextPanel from "../components/ContextPanel";
import MatrixShell from "../components/MatrixShell";
import WorkflowPageShell from "../components/WorkflowPageShell";
import DiagramLibraryPanel from "./DiagramLibraryPanel";

export default function DiagramLibraryPage() {
  return (
    <MatrixShell title="Diagram Library" activePath="/diagram-library">
      <WorkflowPageShell current="knowledge-base">
        <ContextPanel className="mb-6" />
        <DiagramLibraryPanel />
      </WorkflowPageShell>
    </MatrixShell>
  );
}
