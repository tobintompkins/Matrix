import MatrixShell from "../components/MatrixShell";
import WorkflowPageShell from "../components/WorkflowPageShell";
import MatrixAuthGuard from "../components/MatrixAuthGuard";
import { MatrixButton, MatrixPageHeader } from "../components/ui";
import DigitalTwinListPanel from "./DigitalTwinListPanel";

export default function DigitalTwinPage() {
  return (
    <MatrixShell title="Digital Twin" activePath="/digital-twin">
      <WorkflowPageShell current="digital-twin">
        <MatrixAuthGuard requiredPermissions={["VIEW_DIGITAL_TWIN"]}>
          <MatrixPageHeader
            title="Digital Twin"
            subtitle="Machine profiles for the SFX / MPX fleet — identity, health, PM, parts, and service context."
            breadcrumbs={["Matrix", "Service Platform", "Digital Twin"]}
            actions={
              <MatrixButton href="/scanner" variant="secondary" size="md">
                Open Scanner
              </MatrixButton>
            }
          />
          <DigitalTwinListPanel />
        </MatrixAuthGuard>
      </WorkflowPageShell>
    </MatrixShell>
  );
}
