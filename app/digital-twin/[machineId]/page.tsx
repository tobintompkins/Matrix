import { notFound } from "next/navigation";
import MatrixShell from "../../components/MatrixShell";
import WorkflowPageShell from "../../components/WorkflowPageShell";
import MatrixAuthGuard from "../../components/MatrixAuthGuard";
import { getDigitalTwinMachine } from "@/lib/digital-twin/data";
import DigitalTwinDetailPanel from "../DigitalTwinDetailPanel";

type PageProps = {
  params: Promise<{ machineId: string }>;
};

export default async function DigitalTwinMachinePage({ params }: PageProps) {
  const { machineId } = await params;
  const machine = getDigitalTwinMachine(machineId);

  if (!machine) {
    notFound();
  }

  return (
    <MatrixShell
      title={`Digital Twin · ${machine.identity.assetTag}`}
      activePath="/digital-twin"
    >
      <WorkflowPageShell
        current="digital-twin"
        context={{
          customer: machine.location.customerName,
          assetId: machine.identity.assetTag,
          printer: machine.identity.machineId.toLowerCase(),
          model: machine.identity.printerModel,
        }}
      >
        <MatrixAuthGuard requiredPermissions={["VIEW_DIGITAL_TWIN"]}>
          <DigitalTwinDetailPanel machine={machine} />
        </MatrixAuthGuard>
      </WorkflowPageShell>
    </MatrixShell>
  );
}
