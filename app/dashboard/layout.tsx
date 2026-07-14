import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Service Hub | Matrix",
  description:
    "Monitor service operations, preventive maintenance, customer equipment, parts, and technician activity from one workspace.",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
