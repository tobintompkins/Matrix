import Link from "next/link";
import MatrixShell from "../../components/MatrixShell";
import { MatrixButton, MatrixCard, MatrixEmptyState } from "../../components/ui";

export default function DigitalTwinNotFound() {
  return (
    <MatrixShell title="Digital Twin" activePath="/digital-twin">
      <MatrixCard title="Machine Not Found">
        <MatrixEmptyState
          title="No Digital Twin profile for this ID"
          description="The machine ID may be invalid, or the sample fleet does not include this asset yet."
          actionLabel="Back to Digital Twin"
          actionHref="/digital-twin"
        />
        <div className="mt-4 flex justify-center">
          <MatrixButton href="/scanner" variant="secondary" size="md">
            Try Scanner Lookup
          </MatrixButton>
        </div>
        <p className="mt-4 text-center text-sm text-slate-500">
          Or{" "}
          <Link href="/digital-twin" className="text-cyan-400 hover:text-cyan-300">
            return to the fleet list
          </Link>
          .
        </p>
      </MatrixCard>
    </MatrixShell>
  );
}
