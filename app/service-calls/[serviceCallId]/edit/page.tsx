import MatrixShell from "../../../components/MatrixShell";
import WorkflowPageShell from "../../../components/WorkflowPageShell";
import MatrixAuthGuard from "../../../components/MatrixAuthGuard";
import { MatrixPageHeader } from "../../../components/ui";
import ServiceCallEditForm from "../../ServiceCallEditForm";

type PageProps = {
  params: Promise<{ serviceCallId: string }>;
};

export default async function EditServiceCallPage({ params }: PageProps) {
  const { serviceCallId } = await params;

  return (
    <MatrixShell title="Edit Service Call" activePath="/service-calls">
      <WorkflowPageShell current="service-ticket">
        <MatrixAuthGuard requiredPermissions={["EDIT_SERVICE_CALL"]}>
          <MatrixPageHeader
            title="Edit Service Call"
            subtitle={`Update work order ${serviceCallId}`}
            breadcrumbs={["Matrix", "Service Calls", serviceCallId, "Edit"]}
          />
          <ServiceCallEditForm serviceCallId={serviceCallId} />
        </MatrixAuthGuard>
      </WorkflowPageShell>
    </MatrixShell>
  );
}
