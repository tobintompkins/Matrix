import MatrixShell from "../../components/MatrixShell";
import MatrixAuthGuard from "../../components/MatrixAuthGuard";
import { MatrixPageHeader } from "../../components/ui";
import NotificationPreferencesPanel from "./NotificationPreferencesPanel";

export default function NotificationPreferencesPage() {
  return (
    <MatrixShell title="Notification Preferences" activePath="/notifications">
      <MatrixAuthGuard
        requiredPermissions={["MANAGE_NOTIFICATION_PREFERENCES"]}
      >
        <MatrixPageHeader
          title="Notification Preferences"
          subtitle="In-app, daily, and weekly summaries. Email and SMS channels are reserved for later."
          breadcrumbs={[
            "Matrix",
            "Service Platform",
            "Notifications",
            "Preferences",
          ]}
        />
        <NotificationPreferencesPanel />
      </MatrixAuthGuard>
    </MatrixShell>
  );
}
