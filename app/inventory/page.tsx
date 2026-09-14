import MatrixShell from "../components/MatrixShell";
import WorkflowPageShell from "../components/WorkflowPageShell";
import WorkflowPanel from "../components/WorkflowPanel";
import {
  MatrixButton,
  MatrixPageHeader,
} from "../components/ui";
import { getWorkflowActions } from "@/lib/workflow/registry";
import InventoryFoundationPanel from "./InventoryFoundationPanel";
import EnterpriseInventoryPanel from "./EnterpriseInventoryPanel";
import InventorySubnav from "./components/InventorySubnav";

export default function InventoryPage() {
  const workflowActions = getWorkflowActions("inventory", {});

  return (
    <MatrixShell title="Inventory" activePath="/inventory">
      <WorkflowPageShell current="inventory">
        <MatrixPageHeader
          title="Inventory"
          subtitle="Warehouses, parts catalog, multi-location stock, truck inventory, receiving, transfers, and purchase requests."
          breadcrumbs={["Matrix", "Workspace", "Inventory"]}
          actions={
            <div className="flex flex-wrap gap-2">
              <MatrixButton href="/inventory/warehouses" variant="primary" size="md">
                Warehouses
              </MatrixButton>
              <MatrixButton href="/inventory/receiving" variant="secondary" size="md">
                Receiving
              </MatrixButton>
              <MatrixButton href="/inventory/truck" variant="secondary" size="md">
                Truck Stock
              </MatrixButton>
              <MatrixButton href="/order-parts" variant="secondary" size="md">
                Order Parts
              </MatrixButton>
            </div>
          }
        />

        <InventorySubnav />

        <WorkflowPanel
          title="Workflow"
          description="Create orders, view model compatibility, and open guided diagrams."
          actions={workflowActions}
          className="mb-8"
        />

        <div className="mb-10">
          <EnterpriseInventoryPanel />
        </div>

        <InventoryFoundationPanel />
      </WorkflowPageShell>
    </MatrixShell>
  );
}
