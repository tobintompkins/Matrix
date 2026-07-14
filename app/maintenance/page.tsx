import MatrixShell from "../components/MatrixShell";
import WorkflowPageShell from "../components/WorkflowPageShell";
import MatrixAuthGuard from "../components/MatrixAuthGuard";
import { MatrixButton, MatrixPageHeader } from "../components/ui";
import FleetMaintenanceDashboard from "./FleetMaintenanceDashboard";
import PmIntelligenceDashboard from "./PmIntelligenceDashboard";
import PmCleaningCountDashboard from "./PmCleaningCountDashboard";
import MaintenanceSubnav from "./components/MaintenanceSubnav";

export default function MaintenancePage() {
  return (
    <MatrixShell title="Preventive Maintenance" activePath="/maintenance">
      <WorkflowPageShell current="start-pm">
        <MatrixAuthGuard requiredPermissions={["VIEW_FLEET_MAINTENANCE"]}>
          <MatrixPageHeader
            title="Preventive Maintenance"
            subtitle="Impression-meter PM cleaning counts — overdue, due, history, and per-machine intervals (Prisma)."
            breadcrumbs={["Matrix", "Service Platform", "Preventive Maintenance"]}
            actions={
              <div className="flex flex-wrap gap-2">
                <MatrixButton href="/maintenance/counts" variant="primary" size="md">
                  Enter Counts
                </MatrixButton>
                <MatrixButton href="/maintenance/history" variant="secondary" size="md">
                  PM History
                </MatrixButton>
                <MatrixButton href="/digital-twin" variant="secondary" size="md">
                  Digital Twin
                </MatrixButton>
              </div>
            }
          />
          <MaintenanceSubnav />

          <div className="mb-12">
            <PmCleaningCountDashboard />
          </div>

          <div className="mb-12 border-t border-slate-800 pt-8">
            <h2 className="mb-4 text-lg font-semibold text-slate-200">
              PM Intelligence (Patch 44)
            </h2>
            <PmIntelligenceDashboard />
          </div>

          <div className="border-t border-slate-800 pt-8">
            <h2 className="mb-4 text-lg font-semibold text-slate-200">
              Classic fleet planning
            </h2>
            <FleetMaintenanceDashboard />
          </div>
        </MatrixAuthGuard>
      </WorkflowPageShell>
    </MatrixShell>
  );
}
