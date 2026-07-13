import Link from "next/link";
import MatrixShell from "./MatrixShell";

type ComingSoonProps = {
  title: string;
  activePath?: string;
};

export default function ComingSoon({
  title,
  activePath = "/dashboard",
}: ComingSoonProps) {
  return (
    <MatrixShell title={title} activePath={activePath}>
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="text-sm text-cyan-400 hover:text-cyan-300"
        >
          ← Back to Dashboard
        </Link>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-12 text-center">
        <p className="text-sm uppercase tracking-[0.3em] text-cyan-400">
          Matrix
        </p>
        <h3 className="mt-4 text-3xl font-bold">{title}</h3>
        <p className="mt-4 text-lg text-slate-400">Coming Soon</p>
        <p className="mt-2 text-sm text-slate-500">
          This workflow is planned for a future release.
        </p>
      </div>
    </MatrixShell>
  );
}
