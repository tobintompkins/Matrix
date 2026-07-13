import Link from "next/link";
import MatrixShell from "@/app/components/MatrixShell";

export default function PrinterNotFound() {
  return (
    <MatrixShell title="Printer Not Found" activePath="/fleet">
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center">
        <h3 className="text-2xl font-bold">Printer Not Found</h3>
        <p className="mt-2 text-slate-400">
          No printer matches that asset ID.
        </p>
        <Link
          href="/fleet"
          className="mt-6 inline-block text-cyan-400 hover:text-cyan-300"
        >
          ← Back to Fleet
        </Link>
      </div>
    </MatrixShell>
  );
}
