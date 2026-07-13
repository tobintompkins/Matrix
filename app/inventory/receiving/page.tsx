"use client";

import MatrixShell from "../../components/MatrixShell";
import { MatrixPageHeader } from "../../components/ui";
import InventorySubnav from "../components/InventorySubnav";
import ReceivingWizard from "../components/ReceivingWizard";

export default function ReceivingPage() {
  return (
    <MatrixShell title="Receiving" activePath="/inventory">
      <MatrixPageHeader
        title="Receiving"
        subtitle="Seven-step receiving wizard — select PO, verify, inspect, put away, print labels, and post inventory."
        breadcrumbs={["Matrix", "Inventory", "Receiving"]}
      />
      <InventorySubnav />
      <ReceivingWizard />
    </MatrixShell>
  );
}
