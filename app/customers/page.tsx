import MatrixShell from "../components/MatrixShell";
import WorkflowPageShell from "../components/WorkflowPageShell";
import WorkflowPanel from "../components/WorkflowPanel";
import CustomerMaintenanceSummarySection from "../components/maintenance/CustomerMaintenanceSummarySection";
import {
  MatrixButton,
  MatrixCard,
  MatrixPageHeader,
  MatrixStatCard,
} from "../components/ui";
import { getWorkflowActions } from "@/lib/workflow/registry";
import CustomersTable from "./CustomersTable";
import EnterpriseCrmPanel from "./EnterpriseCrmPanel";

const customers = [
  {
    name: "SFX / MPX",
    siteLocation: "Southern Maine",
    contact: "Toby Tompkins",
    phone: "Placeholder",
    printers: 12,
    status: "Active",
    defaultAssetId: "MX-GD-002",
    defaultPrinter: "mx-gd-002",
    defaultModel: "GD9630",
    crmId: "cust-sfx",
  },
];

export default function CustomersPage() {
  const customer = customers[0];
  const workflowContext = {
    customer: customer.name,
    assetId: customer.defaultAssetId,
    printer: customer.defaultPrinter,
    model: customer.defaultModel,
  };
  const workflowActions = getWorkflowActions("customer", workflowContext);

  return (
    <MatrixShell title="Customers" activePath="/customers">
      <WorkflowPageShell current="customer" context={workflowContext}>
        <MatrixPageHeader
          title="Customers"
          subtitle="Enterprise accounts, sites, assets, contracts, warranties, and fleet dashboards."
          breadcrumbs={["Matrix", "Service Platform", "Customers"]}
          actions={
            <div className="flex flex-wrap gap-2">
              <MatrixButton href="/customers/cust-sfx" variant="secondary" size="md">
                Open SFX Dashboard
              </MatrixButton>
              <MatrixButton href="/add-customer" variant="primary" size="md">
                Add Customer
              </MatrixButton>
            </div>
          }
        />

        <WorkflowPanel
          title="Workflow"
          description="Start the service workflow from the customer account."
          actions={workflowActions}
          className="mb-8"
        />

        <div className="grid gap-6 md:grid-cols-3">
          <MatrixStatCard label="Launch Accounts" value={1} />
          <MatrixStatCard label="Active Sites" value={1} />
          <MatrixStatCard label="Open Tickets" value={3} />
        </div>

        <div className="mt-8">
          <CustomerMaintenanceSummarySection customerName={customer.name} />
        </div>

        <div className="mt-10">
          <EnterpriseCrmPanel />
        </div>

        <MatrixCard
          title="Legacy launch table"
          subtitle="Hardcoded SFX / MPX row preserved for existing workflow links."
          className="mt-8"
          bodyClassName="p-0"
          padding={false}
        >
          <div className="p-6">
            <CustomersTable data={customers} />
          </div>
        </MatrixCard>
      </WorkflowPageShell>
    </MatrixShell>
  );
}
