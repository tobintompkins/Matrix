import MatrixShell from "../../components/MatrixShell";
import WorkflowPageShell from "../../components/WorkflowPageShell";
import MatrixAuthGuard from "../../components/MatrixAuthGuard";
import { MatrixPageHeader } from "../../components/ui";
import { sampleServiceCalls } from "@/lib/service-calls";
import ServiceCallDetailPanel from "../ServiceCallDetailPanel";
import { notFound } from "next/navigation";

type PageProps = {
  params: Promise<{ serviceCallId: string }>;
};

export default async function ServiceCallDetailPage({ params }: PageProps) {
  const { serviceCallId } = await params;
  const seedHit = sampleServiceCalls.find(
    (c) =>
      c.id.toUpperCase() === serviceCallId.toUpperCase() ||
      c.workOrderNumber.toUpperCase() === serviceCallId.toUpperCase(),
  );

  // Client store may hold newly created calls; seed miss is OK — panel handles missing.
  // Only 404 for clearly invalid empty ids.
  if (!serviceCallId.trim()) {
    notFound();
  }

  return (
    <MatrixShell title="Service Call" activePath="/service-calls">
      <WorkflowPageShell
        current="service-ticket"
        context={
          seedHit
            ? {
                ticket: seedHit.ticketNumber,
                customer: seedHit.machine.customerName,
                assetId: seedHit.machine.assetTag,
                printer: seedHit.machine.machineId.toLowerCase(),
                model: seedHit.machine.printerModel,
              }
            : undefined
        }
      >
        <MatrixAuthGuard requiredPermissions={["VIEW_SERVICE_CALLS"]}>
          <MatrixPageHeader
            title={seedHit?.workOrderNumber ?? "Service Call"}
            subtitle={
              seedHit?.problem.issueTitle ??
              "Work order detail, status workflow, parts, and notes."
            }
            breadcrumbs={["Matrix", "Service Calls", serviceCallId]}
          />
          <ServiceCallDetailPanel serviceCallId={serviceCallId} />
        </MatrixAuthGuard>
      </WorkflowPageShell>
    </MatrixShell>
  );
}
