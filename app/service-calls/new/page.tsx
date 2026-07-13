import { Suspense } from "react";
import MatrixShell from "../../components/MatrixShell";
import WorkflowPageShell from "../../components/WorkflowPageShell";
import MatrixAuthGuard from "../../components/MatrixAuthGuard";
import { MatrixPageHeader } from "../../components/ui";
import ServiceCallCreateForm from "../ServiceCallCreateForm";

export default function NewServiceCallPage() {
  return (
    <MatrixShell title="New Service Call" activePath="/service-calls">
      <WorkflowPageShell current="service-ticket">
        <MatrixAuthGuard requiredPermissions={["CREATE_SERVICE_CALL"]}>
          <MatrixPageHeader
            title="New Service Call"
            subtitle="Create a work order linked to a Digital Twin machine profile."
            breadcrumbs={[
              "Matrix",
              "Service Calls",
              "New",
            ]}
          />
          <Suspense
            fallback={
              <p className="mt-6 text-sm text-slate-400">Loading form…</p>
            }
          >
            <ServiceCallCreateForm />
          </Suspense>
        </MatrixAuthGuard>
      </WorkflowPageShell>
    </MatrixShell>
  );
}
