import MatrixShell from "../../components/MatrixShell";
import { MatrixButton, MatrixPageHeader } from "../../components/ui";
import TechnicianMobileWorkflow from "../TechnicianMobileWorkflow";

export default function DispatchMobilePage() {
  return (
    <MatrixShell title="Tech Mobile" activePath="/dispatch">
      <MatrixPageHeader
        title="Technician mobile workflow"
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
