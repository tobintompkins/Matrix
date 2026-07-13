import MatrixShell from "../components/MatrixShell";
import MatrixAuthGuard from "../components/MatrixAuthGuard";
import { MatrixPageHeader } from "../components/ui";
import NotificationsCenterPanel from "./NotificationsCenterPanel";

export default function NotificationsPage() {
  return (
    <MatrixShell title="Notifications" activePath="/notifications">
      <MatrixAuthGuard requiredPermissions={["VIEW_NOTIFICATIONS"]}>
        <MatrixPageHeader
          title="Notification Center"
          subtitle="Smart maintenance reminders, completions, and schedule changes."
          breadcrumbs={["Matrix", "Service Platform", "Notifications"]}
        />
        <NotificationsCenterPanel />
      </MatrixAuthGuard>
    </MatrixShell>
  );
}
