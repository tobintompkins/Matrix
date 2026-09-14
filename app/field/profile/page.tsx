"use client";
import { useFieldIdentity } from "@/app/field/FieldIdentityProvider";

import Link from "next/link";
import FieldShell from "../FieldShell";

export default function FieldProfilePage() {
  const { technicianName: TECH, role } = useFieldIdentity();
  return (
    <FieldShell title="Profile">
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <p className="text-xs uppercase tracking-wide text-slate-500">Technician</p>
        <h2 className="mt-1 text-2xl font-bold">{TECH}</h2>
        <p className="mt-2 text-sm text-slate-400">
          Role: {role.replaceAll("_", " ")}
        </p>
        <p className="mt-4 text-sm text-slate-300">
          New Field actions use your signed-in identity. Legacy offline data remains on this device; full storage isolation and sign-out cleanup still require verification.
        </p>
      </div>

      <div className="mt-4 grid gap-3">
        <Link
          href="/field/settings"
          className="flex min-h-14 items-center rounded-xl border border-slate-700 bg-slate-900 px-4 font-semibold"
        >
          Field Data Settings
        </Link>
        <Link
          href="/field/offline"
          className="flex min-h-14 items-center rounded-xl border border-slate-700 bg-slate-900 px-4 font-semibold"
        >
          Offline Queue
        </Link>
        <Link
          href="/notifications"
          className="flex min-h-14 items-center rounded-xl border border-slate-700 bg-slate-900 px-4 font-semibold"
        >
          Notifications
        </Link>
      </div>
    </FieldShell>
  );
}
