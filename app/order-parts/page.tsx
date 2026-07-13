import ContextPanel from "../components/ContextPanel";
import MatrixShell from "../components/MatrixShell";
import WorkflowPageShell from "../components/WorkflowPageShell";
import OrderPartsForm from "./OrderPartsForm";

export default function OrderPartsPage() {
  return (
    <MatrixShell title="Order Parts" activePath="/dashboard">
      <WorkflowPageShell current="order-parts">
        <ContextPanel className="mb-6" />
        <OrderPartsForm />
      </WorkflowPageShell>
    </MatrixShell>
  );
}
