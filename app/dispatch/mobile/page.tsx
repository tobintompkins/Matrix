import MatrixShell from "../../components/MatrixShell";
import { MatrixButton, MatrixPageHeader } from "../../components/ui";
import TechnicianMobileWorkflow from "../TechnicianMobileWorkflow";

export default function DispatchMobilePage() {
  return (
    <MatrixShell title="Field Work" activePath="/dispatch">
      <MatrixPageHeader
        title="Field Work"
        subtitle="Large touch controls for accept, travel, diagnose, parts, and completion."
        breadcrumbs={["Matrix", "Dispatch", "Mobile"]}
        actions={
          <MatrixButton href="/dispatch" variant="secondary" size="md">
            Dispatch board
          </MatrixButton>
        }
      />
      <TechnicianMobileWorkflow />
    </MatrixShell>
  );
}
