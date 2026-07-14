import type { Metadata } from "next";
import MatrixShell from "../components/MatrixShell";
import MatrixAuthGuard from "../components/MatrixAuthGuard";

export const metadata: Metadata = {
  title: "Administration Center | Matrix",
  description:
    "Manage users, access, organization settings, system configuration, security controls, and administrative activity.",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MatrixShell title="Administration Center" activePath="/admin">
      <MatrixAuthGuard
        requiredPermissions={["VIEW_ADMINISTRATION"]}
        pathname="/admin"
        accessDeniedMessage="You do not have permission to access the Administration Center."
      >
        {children}
      </MatrixAuthGuard>
    </MatrixShell>
  );
}
