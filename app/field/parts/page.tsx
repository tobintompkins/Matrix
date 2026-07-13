import { Suspense } from "react";
import FieldPartsInner from "./FieldPartsInner";

export default function FieldPartsPage() {
  return (
    <Suspense fallback={<div className="p-4 text-slate-400">Loading parts…</div>}>
      <FieldPartsInner />
    </Suspense>
  );
}
