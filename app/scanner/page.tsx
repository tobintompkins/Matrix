import MatrixShell from "../components/MatrixShell";
import WorkflowPageShell from "../components/WorkflowPageShell";
import { MatrixButton, MatrixPageHeader } from "../components/ui";
import ScannerPanel from "./ScannerPanel";

export default function ScannerPage() {
  return (
    <MatrixShell title="Scanner / Lookup" activePath="/scanner">
      <WorkflowPageShell current="inventory">
        <MatrixPageHeader
          title="Scanner / Lookup"
          subtitle="Scan or enter QR/barcode values to find parts, printers, inventory, and diagram actions."
          breadcrumbs={["Matrix", "Service Platform", "Scanner"]}
          actions={
            <MatrixButton href="/dashboard" variant="secondary" size="md">
              Back to Service Hub
            </MatrixButton>
          }
        />
        <ScannerPanel />
      </WorkflowPageShell>
    </MatrixShell>
  );
}
