import MatrixShell from "../components/MatrixShell";
import WorkflowPageShell from "../components/WorkflowPageShell";
import KnowledgeBasePanel from "./KnowledgeBasePanel";

export default function KnowledgeBasePage() {
  return (
    <MatrixShell title="Knowledge Base" activePath="/knowledge-base">
      <WorkflowPageShell current="knowledge-base">
        <KnowledgeBasePanel />
      </WorkflowPageShell>
    </MatrixShell>
  );
}
