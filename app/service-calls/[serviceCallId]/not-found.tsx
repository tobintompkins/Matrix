import Link from "next/link";
import MatrixShell from "../../components/MatrixShell";
import {
  MatrixButton,
  MatrixCard,
  MatrixEmptyState,
} from "../../components/ui";

export default function ServiceCallNotFound() {
  return (
    <MatrixShell title="Service Call" activePath="/service-calls">
      <MatrixCard title="Service Call Not Found">
        <MatrixEmptyState
          title="No service call for this ID"
          description="The service call ID may be invalid, or it only exists in another browser session."
          actionLabel="Back to Service Calls"
          actionHref="/service-calls"
        />
        <div className="mt-4 flex justify-center gap-3">
          <MatrixButton href="/service-calls/new" variant="secondary" size="md">
            New Service Call
          </MatrixButton>
          <Link href="/scanner" className="text-sm text-cyan-400 hover:text-cyan-300 self-center">
            Try Scanner
          </Link>
        </div>
      </MatrixCard>
    </MatrixShell>
  );
}
