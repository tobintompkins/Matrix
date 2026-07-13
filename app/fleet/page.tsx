import MatrixShell from "../components/MatrixShell";
import WorkflowPageShell from "../components/WorkflowPageShell";
import WorkflowPanel from "../components/WorkflowPanel";
import {
  MatrixButton,
  MatrixCard,
  MatrixPageHeader,
  MatrixStatCard,
} from "../components/ui";
import { getWorkflowActions } from "@/lib/workflow/registry";
import FleetTable from "./FleetTable";

const fleet = [
  {
    assetId: "MX-GD-001",
    model: "GD9630",
    location: "SFX Chicago Print Room",
    status: "Online",
    meterCount: "1,284,320",
    lastService: "2026-06-21",
  },
  {
    assetId: "MX-GD-002",
    model: "GD9630",
    location: "SFX Chicago Production Floor",
    status: "PM Due",
    meterCount: "1,112,945",
    lastService: "2026-05-30",
  },
  {
    assetId: "MX-GD-003",
    model: "GD9630",
    location: "MPX New York Mail Center",
    status: "Online",
    meterCount: "987,410",
    lastService: "2026-06-18",
  },
  {
    assetId: "MX-GD-004",
    model: "GD9630",
    location: "MPX New Jersey Operations",
    status: "Attention",
    meterCount: "1,356,070",
    lastService: "2026-06-09",
  },
  {
    assetId: "MX-GD-005",
    model: "GD9630",
    location: "SFX Dallas Fulfillment",
    status: "Online",
    meterCount: "864,255",
    lastService: "2026-06-25",
  },
  {
    assetId: "MX-GD-006",
    model: "GD9630",
    location: "MPX Atlanta Production",
    status: "In Service",
    meterCount: "1,041,630",
    lastService: "2026-07-02",
  },
  {
    assetId: "MX-GD-007",
    model: "GD9630",
    location: "SFX Phoenix Distribution",
    status: "Online",
    meterCount: "776,540",
    lastService: "2026-06-14",
  },
  {
    assetId: "MX-GL-001",
    model: "GL9730",
    location: "MPX Los Angeles Plant",
    status: "Online",
    meterCount: "654,870",
    lastService: "2026-06-27",
  },
  {
    assetId: "MX-VA-001",
    model: "Valezus",
    location: "SFX Chicago Design Studio",
    status: "Online",
    meterCount: "238,910",
    lastService: "2026-06-16",
  },
  {
    assetId: "MX-VA-002",
    model: "Valezus",
    location: "MPX Miami Creative Center",
    status: "Attention",
    meterCount: "312,480",
    lastService: "2026-06-08",
  },
  {
    assetId: "MX-VA-003",
    model: "Valezus",
    location: "SFX Seattle Graphics Lab",
    status: "PM Due",
    meterCount: "287,650",
    lastService: "2026-05-28",
  },
  {
    assetId: "MX-VA-004",
    model: "Valezus",
    location: "MPX Boston Innovation Hub",
    status: "Online",
    meterCount: "194,220",
    lastService: "2026-06-29",
  },
];

const totalPrinters = fleet.length;
const gdCount = fleet.filter((printer) => printer.model === "GD9630").length;
const glCount = fleet.filter((printer) => printer.model === "GL9730").length;
const valezusCount = fleet.filter((printer) => printer.model === "Valezus").length;

export default function FleetPage() {
  const workflowContext = {
    customer: "SFX / MPX",
    assetId: "MX-GD-002",
    printer: "mx-gd-002",
    model: "GD9630",
  };
  const workflowActions = getWorkflowActions("fleet", workflowContext);

  return (
    <MatrixShell title="Fleet" activePath="/fleet">
      <WorkflowPageShell current="digital-twin" context={workflowContext}>
        <MatrixPageHeader
          title="Fleet"
          subtitle="Monitor printer assets across customer sites and service locations."
          breadcrumbs={["Matrix", "Service Platform", "Fleet"]}
          actions={
            <MatrixButton href="/register-printer" variant="primary" size="md">
              Register Printer
            </MatrixButton>
          }
        />

        <WorkflowPanel
          title="Workflow"
          description="Open service tickets, inventory, and PM workflows from the fleet view."
          actions={workflowActions}
          className="mb-8"
        />

        <div className="grid gap-6 md:grid-cols-4">
          <MatrixStatCard label="Total Printers" value={totalPrinters} />
          <MatrixStatCard label="GD9630" value={gdCount} />
          <MatrixStatCard label="GL9730" value={glCount} />
          <MatrixStatCard label="Valezus" value={valezusCount} />
        </div>

        <MatrixCard
          title="Printer Fleet"
          subtitle="Hardcoded launch fleet view for GD9630, GL9730, and Valezus devices."
          className="mt-8"
          bodyClassName="p-0"
          padding={false}
        >
          <div className="p-6">
            <FleetTable data={fleet} />
          </div>
        </MatrixCard>
      </WorkflowPageShell>
    </MatrixShell>
  );
}
