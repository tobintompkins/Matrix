import ContextPanel from "../components/ContextPanel";
import MatrixShell from "../components/MatrixShell";
import WorkflowPageShell from "../components/WorkflowPageShell";
import JobWizardForm from "./JobWizardForm";

export default function StartPMPage() {
  return (
    <MatrixShell title="Start PM / Job Wizard" activePath="/dashboard">
      <WorkflowPageShell current="start-pm">
        <ContextPanel className="mb-6" />
        <JobWizardForm />
      </WorkflowPageShell>
    </MatrixShell>
  );
}
