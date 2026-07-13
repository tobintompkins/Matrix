"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import FieldShell from "../../FieldShell";
import {
  buildAllMaintenanceSnapshots,
  getMaintenanceProfile,
} from "@/lib/maintenance";
import { listWorkOrders } from "@/lib/work-orders";

export default function FieldPrinterQuickViewPage() {
  const params = useParams();
  const printerId = String(params.printerId ?? "");
  const profile = useMemo(() => getMaintenanceProfile(printerId), [printerId]);
  const snapshots = useMemo(
    () => (profile ? buildAllMaintenanceSnapshots(profile) : null),
    [profile],
  );
  const openWos = useMemo(
    () =>
      listWorkOrders().filter(
        (w) =>
          w.printerId === printerId &&
          !["COMPLETED", "CANCELLED", "CLOSED"].includes(w.status),
      ),
    [printerId],
  );

  if (!profile) {
    return (
      <FieldShell title="Printer">
        <p className="text-slate-400">Printer not found in maintenance profiles.</p>
        <Link href="/field/printers" className="mt-4 text-cyan-400">
          Back
        </Link>
      </FieldShell>
    );
  }

  return (
    <FieldShell title={profile.nickname || profile.assetTag}>
      <div className="mb-4 rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <p className="text-sm text-slate-400">
          {profile.customerName} · {profile.siteName}
        </p>
        <p className="mt-2 text-sm">
          Model {profile.printerModel} · Asset {profile.assetTag}
        </p>
        <p className="mt-2 text-2xl font-bold">
          {profile.currentCopyCount?.toLocaleString() ?? "—"}
        </p>
        <p className="text-xs text-slate-500">Current copy count</p>
      </div>

      {snapshots && (
        <div className="mb-4 grid grid-cols-2 gap-2 text-sm">
          {snapshots.map((s) => (
            <div
              key={s.kind}
              className="rounded-xl border border-slate-800 bg-slate-900 p-3"
            >
              <p className="text-xs text-slate-500">{s.kind}</p>
              <p className="font-semibold text-white">{s.status}</p>
              <p className="text-xs text-slate-400">
                Next due {s.nextDueCount?.toLocaleString() ?? "—"}
              </p>
            </div>
          ))}
        </div>
      )}

      <h3 className="mb-2 text-sm font-semibold text-slate-400">Open work orders</h3>
      <ul className="mb-6 space-y-2">
        {openWos.length === 0 && (
          <li className="text-sm text-slate-500">None</li>
        )}
        {openWos.map((w) => (
          <li key={w.id}>
            <Link href={`/field/work/${w.id}`} className="text-cyan-300">
              {w.workOrderNumber} — {w.title}
            </Link>
          </li>
        ))}
      </ul>

      <div className="grid grid-cols-2 gap-2">
        {[
          {
            label: "Enter Copy Count",
            href: `/field/copy-count?printerId=${printerId}`,
          },
          { label: "Create Work Order", href: "/work-orders/new" },
          {
            label: "Complete Maintenance",
            href: `/field/maintenance?printerId=${printerId}`,
          },
          { label: "View History", href: `/digital-twin/${printerId}` },
          { label: "Find Part", href: "/field/parts" },
          {
            label: "Add Photo",
            href: openWos[0]
              ? `/field/work/${openWos[0].id}/attachments`
              : "/field/work",
          },
        ].map((a) => (
          <Link
            key={a.label}
            href={a.href}
            className="flex min-h-14 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 px-2 text-center text-xs font-semibold"
          >
            {a.label}
          </Link>
        ))}
      </div>
    </FieldShell>
  );
}
