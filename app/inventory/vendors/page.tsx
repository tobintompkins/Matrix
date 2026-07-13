"use client";

import { useMemo } from "react";
import MatrixShell from "../../components/MatrixShell";
import {
  MatrixButton,
  MatrixCard,
  MatrixPageHeader,
  MatrixStatusBadge,
} from "../../components/ui";
import { listVendors } from "@/lib/inventory";

export default function VendorsPage() {
  const vendors = useMemo(() => listVendors(), []);

  return (
    <MatrixShell title="Vendors" activePath="/inventory">
      <MatrixPageHeader
        title="Vendor Management"
        subtitle="Preferred vendors, lead times, shipping methods, and performance metrics."
        breadcrumbs={["Matrix", "Inventory", "Vendors"]}
        actions={
          <MatrixButton href="/inventory" variant="secondary" size="md">
            Back to Inventory
          </MatrixButton>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        {vendors.map((v) => (
          <MatrixCard
            key={v.id}
            title={v.name}
            actions={
              v.preferred ? (
                <MatrixStatusBadge variant="completed" label="Preferred" />
              ) : undefined
            }
          >
            <dl className="grid gap-2 text-sm text-slate-300">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Contact</dt>
                <dd>
                  {v.contactName} · {v.phone}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Email</dt>
                <dd>{v.email}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Lead time</dt>
                <dd>{v.leadTimeDays} days</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Shipping</dt>
                <dd>{v.shippingMethods.join(", ")}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">On-time</dt>
                <dd>{Math.round(v.onTimeRate * 100)}%</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Quality</dt>
                <dd>{Math.round(v.qualityScore * 100)}%</dd>
              </div>
              <div>
                <dt className="mb-1 text-slate-500">Supported parts</dt>
                <dd className="font-mono text-xs text-cyan-300">
                  {v.supportedPartNumbers.join(", ")}
                </dd>
              </div>
            </dl>
          </MatrixCard>
        ))}
      </div>
    </MatrixShell>
  );
}
