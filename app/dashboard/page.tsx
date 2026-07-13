import ContextPanel from "../components/ContextPanel";
import MatrixShell from "../components/MatrixShell";
import FleetCopyCountsCard from "../components/maintenance/FleetCopyCountsCard";
import {
  MatrixButton,
  MatrixInfoPanel,
  MatrixPageHeader,
  MatrixSearchBar,
  MatrixSection,
} from "../components/ui";
import DashboardActivityTable, {
  type ActivityRow,
} from "./DashboardActivityTable";
import DashboardOpsPanel from "./DashboardOpsPanel";

const recentActivity: ActivityRow[] = [
  {
    date: "2026-07-05",
    customer: "SFX / MPX",
    printer: "MX-GD-002 (GD9630)",
    issue: "GD9630 jamming from Tray 2",
    status: "Open",
  },
  {
    date: "2026-07-04",
    customer: "SFX / MPX",
    printer: "MX-VA-002 (Valezus)",
    issue: "Valezus black marks on sheet edge",
    status: "In Progress",
  },
  {
    date: "2026-07-03",
    customer: "SFX / MPX",
    printer: "MX-GL-001 (GL9730)",
    issue: "GL9730 registration alignment issue",
    status: "Open",
  },
  {
    date: "2026-07-02",
    customer: "SFX / MPX",
    printer: "MX-GD-004 (GD9630)",
    issue: "Intermittent paper feed error on high-volume runs",
    status: "In Progress",
  },
  {
    date: "2026-06-30",
    customer: "SFX / MPX",
    printer: "MX-VA-003 (Valezus)",
    issue: "Drum unit replacement — waiting on parts",
    status: "Waiting Parts",
  },
  {
    date: "2026-06-27",
    customer: "SFX / MPX",
    printer: "MX-GD-006 (GD9630)",
    issue: "Master roll tension sensor fault cleared",
    status: "Completed",
  },
];

const priorityAlerts = [
  {
    severity: "high",
    message: "GD9630 Tray 2 jam trend detected",
  },
  {
    severity: "medium",
    message: "Valezus black mark issue needs inspection",
  },
  {
    severity: "low",
    message: "4 parts below reorder level",
  },
];

const fleetMix = [
  { model: "GD9630", count: 7, color: "bg-cyan-500/80" },
  { model: "GL9730", count: 1, color: "bg-slate-400" },
  { model: "Valezus", count: 4, color: "bg-emerald-500/70" },
];

const alertStyles: Record<string, string> = {
  high: "border-rose-500/30 bg-rose-500/5 text-rose-200/90",
  medium: "border-amber-500/30 bg-amber-500/5 text-amber-200/90",
  low: "border-slate-700 bg-slate-900/60 text-slate-300",
};

export default function DashboardPage() {
  const totalFleet = fleetMix.reduce((sum, item) => sum + item.count, 0);

  return (
    <MatrixShell title="Dashboard" activePath="/dashboard">
      <MatrixPageHeader
        title="Operations Overview"
        subtitle="Field service snapshot for the SFX / MPX fleet."
        breadcrumbs={["Matrix", "Service Platform", "Dashboard"]}
        actions={
          <>
            <MatrixButton href="/service-calls/new" variant="primary" size="md">
              New Service Call
            </MatrixButton>
            <MatrixButton href="/order-parts" variant="secondary" size="md">
              Order Parts
            </MatrixButton>
          </>
        }
      />

      <div className="mb-6">
        <DashboardOpsPanel />
      </div>

      <ContextPanel className="mb-6" />

      <div className="mb-6">
        <MatrixSearchBar
          id="global-search"
          placeholder="Search printers, customers, tickets, serial numbers..."
        />
      </div>

      <div className="mb-6">
        <FleetCopyCountsCard />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <MatrixSection
          title="Recent Service Activity"
          subtitle="Latest field service events across the SFX / MPX fleet."
          className="lg:col-span-2"
        >
          <DashboardActivityTable data={recentActivity} />
        </MatrixSection>

        <div className="space-y-6">
          <MatrixInfoPanel
            title="Priority Alerts"
            subtitle="Items requiring attention across fleet and inventory."
          >
            <ul className="space-y-2.5">
              {priorityAlerts.map((alert) => (
                <li
                  key={alert.message}
                  className={`rounded-lg border px-3.5 py-2.5 text-sm ${alertStyles[alert.severity]}`}
                >
                  <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                  {alert.message}
                </li>
              ))}
            </ul>
          </MatrixInfoPanel>

          <MatrixInfoPanel
            title="Fleet Mix"
            subtitle="Active printer distribution by model series."
            footer={
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Total Fleet</span>
                <span className="font-semibold text-cyan-400">{totalFleet}</span>
              </div>
            }
          >
            <div className="space-y-3.5">
              {fleetMix.map((item) => (
                <div key={item.model}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="font-medium text-white">{item.model}</span>
                    <span className="text-slate-400">{item.count}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className={`h-full rounded-full ${item.color}`}
                      style={{ width: `${(item.count / totalFleet) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </MatrixInfoPanel>
        </div>
      </div>
    </MatrixShell>
  );
}
