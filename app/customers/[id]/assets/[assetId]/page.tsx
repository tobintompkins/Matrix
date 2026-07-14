"use client";

import Link from "next/link";
import { use, useMemo, useState } from "react";
import MatrixShell from "@/app/components/MatrixShell";
import {
  MatrixButton,
  MatrixCard,
  MatrixEmptyState,
  MatrixPageHeader,
  MatrixStatCard,
  MatrixStatusBadge,
} from "@/app/components/ui";
import {
  addLifecycleEvent,
  getAsset,
  listDocuments,
  listLifecycle,
  listRelationships,
  listWarranties,
  primaryWarrantyStatus,
  type LifecycleEventType,
} from "@/lib/crm";

function badge(status: string) {
  switch (status) {
    case "ACTIVE":
      return "completed" as const;
    case "EXPIRING_SOON":
    case "MAINTENANCE":
    case "LOANER":
      return "warning" as const;
    case "EXPIRED":
    case "DOWN":
    case "NONE":
      return "error" as const;
    default:
      return "offline" as const;
  }
}

const LIFECYCLE_OPTIONS: LifecycleEventType[] = [
  "REPAIRED",
  "PM_COMPLETED",
  "CLEANING_COMPLETED",
  "JOINT_UNIT_REPLACEMENT",
  "DTF_PM",
  "FIRMWARE_UPDATED",
  "WARRANTY_REPAIR",
  "RELOCATED",
  "UPGRADED",
  "LOANER_INSTALLED",
  "DECOMMISSIONED",
  "DISPOSED",
  "SOLD",
];

export default function AssetDetailPage({
  params,
}: {
  params: Promise<{ id: string; assetId: string }>;
}) {
  const { id, assetId } = use(params);
  const [tick, setTick] = useState(0);
  const [eventType, setEventType] = useState<LifecycleEventType>("PM_COMPLETED");
  const [notice, setNotice] = useState("");

  const asset = useMemo(() => {
    void tick;
    return getAsset(assetId);
  }, [assetId, tick]);

  const lifecycle = useMemo(() => {
    void tick;
    return listLifecycle(assetId);
  }, [assetId, tick]);

  const relationships = useMemo(() => {
    void tick;
    return listRelationships(assetId);
  }, [assetId, tick]);

  const warranties = useMemo(() => {
    void tick;
    return listWarranties(assetId);
  }, [assetId, tick]);

  const documents = useMemo(() => {
    void tick;
    return listDocuments({ assetId, customerId: id });
  }, [assetId, id, tick]);

  const warrantyStatus = useMemo(() => {
    void tick;
    return primaryWarrantyStatus(assetId);
  }, [assetId, tick]);

  if (!asset || asset.customerId !== id) {
    return (
      <MatrixShell title="Asset" activePath="/customers">
        <MatrixEmptyState
          title="Asset not found"
          description="Return to the customer record."
          actionLabel="Back"
          onAction={() => {
            window.location.href = `/customers/${id}`;
          }}
        />
      </MatrixShell>
    );
  }

  const twinHref = asset.digitalTwinId
    ? `/printers/${asset.digitalTwinId.toLowerCase()}`
    : null;

  return (
    <MatrixShell title={asset.assetNumber} activePath="/customers">
      <MatrixPageHeader
        title={`${asset.assetNumber} · ${asset.nickname || asset.model}`}
        subtitle={`SN ${asset.serialNumber} · ${asset.department} · Floor ${asset.floor} · ${asset.room}`}
        breadcrumbs={["Matrix", "Customers", "Assets", asset.assetNumber]}
        actions={
          <div className="flex flex-wrap gap-2">
            <MatrixButton href={`/customers/${id}/sites/${asset.siteId}`} variant="secondary" size="md">
              Site
            </MatrixButton>
            {twinHref ? (
              <MatrixButton href={twinHref} variant="secondary" size="md">
                Digital Twin
              </MatrixButton>
            ) : null}
            <MatrixButton href={`/customers/${id}`} variant="primary" size="md">
              Customer
            </MatrixButton>
          </div>
        }
      />

      {notice ? (
        <p className="mb-4 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-100">
          {notice}
        </p>
      ) : null}

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MatrixStatCard label="Status" value={asset.status} />
        <MatrixStatCard
          label="Copy count"
          value={asset.currentCopyCount?.toLocaleString() ?? "—"}
        />
        <MatrixStatCard label="Monthly volume" value={asset.monthlyVolume?.toLocaleString() ?? "—"} />
        <MatrixStatCard label="Warranty" value={warrantyStatus} />
        <MatrixStatCard label="Firmware" value={asset.firmwareVersion || "—"} />
        <MatrixStatCard label="Controller" value={asset.controllerVersion || "—"} />
        <MatrixStatCard label="IP" value={asset.ipAddress || "—"} />
        <MatrixStatCard label="Hostname" value={asset.hostname || "—"} />
      </div>

      <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
        Work order highlight — warranty status:{" "}
        <MatrixStatusBadge label={warrantyStatus} variant={badge(warrantyStatus)} />
        {warranties[0] ? (
          <span className="ml-2 text-amber-200/80">
            ({warranties[0].kind} through {warranties[0].endDate.slice(0, 10)})
          </span>
        ) : null}
      </div>

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <MatrixCard title="Asset identity" subtitle="Network, labels, ownership.">
          <dl className="grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-slate-500">MAC</dt>
              <dd>{asset.macAddress || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">QR label</dt>
              <dd className="font-mono text-cyan-300">{asset.qrLabel}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Barcode</dt>
              <dd className="font-mono">{asset.barcode}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Ownership</dt>
              <dd>{asset.ownership}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Lease</dt>
              <dd>{asset.leaseInfo || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Install / purchase</dt>
              <dd>
                {asset.installDate ?? "—"} / {asset.purchaseDate ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Warranty window</dt>
              <dd>
                {asset.warrantyStart ?? "—"} → {asset.warrantyEnd ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">GPS</dt>
              <dd>
                {asset.latitude != null && asset.longitude != null
                  ? `${asset.latitude}, ${asset.longitude}`
                  : "—"}
              </dd>
            </div>
          </dl>
          <div className="mt-4 rounded-lg border border-dashed border-slate-700 bg-slate-950/50 p-4 text-center">
            <p className="text-xs uppercase tracking-wide text-slate-500">Printable QR label</p>
            <p className="mt-2 font-mono text-lg text-cyan-300">{asset.qrLabel}</p>
            <p className="mt-1 text-xs text-slate-400">
              Scan opens /customers/{id}/assets/{asset.id}
            </p>
          </div>
        </MatrixCard>

        <MatrixCard title="Connected equipment" subtitle="Controller → accessories → finishers.">
          {relationships.length === 0 ? (
            <MatrixEmptyState title="No linked equipment" />
          ) : (
            <ul className="space-y-2 text-sm">
              {relationships.map((r) => (
                <li key={r.id} className="rounded-lg border border-slate-800 px-3 py-2">
                  <p className="font-medium text-white">
                    {r.kind.replaceAll("_", " ")} · {r.childName}
                  </p>
                  <p className="text-xs text-slate-400">
                    SN {r.serialNumber || "—"} · {r.notes}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </MatrixCard>
      </div>

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <MatrixCard title="Warranties" subtitle="Manufacturer, extended, and service coverage.">
          <ul className="divide-y divide-slate-800 text-sm">
            {warranties.map((w) => (
              <li key={w.id} className="py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-white">{w.kind}</span>
                  <MatrixStatusBadge label={w.status} variant={badge(w.status)} />
                </div>
                <p className="text-xs text-slate-400">
                  {w.startDate.slice(0, 10)} → {w.endDate.slice(0, 10)}
                </p>
                <p className="text-xs text-slate-500">
                  Covered: {w.coveredComponents.join(", ") || "—"}
                </p>
              </li>
            ))}
          </ul>
        </MatrixCard>

        <MatrixCard title="Documents & photos" subtitle="Asset-linked files.">
          {documents.length === 0 ? (
            <p className="text-sm text-slate-400">No documents linked to this asset.</p>
          ) : (
            <ul className="divide-y divide-slate-800 text-sm">
              {documents.map((d) => (
                <li key={d.id} className="py-2">
                  <p className="font-medium text-white">
                    {d.title} <span className="text-xs text-slate-500">v{d.version}</span>
                  </p>
                  <p className="text-xs text-slate-400">
                    {d.category} · {d.fileName}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </MatrixCard>
      </div>

      <MatrixCard title="Lifecycle timeline" subtitle="Chronological asset history.">
        <div className="mb-4 flex flex-wrap gap-2">
          <select
            value={eventType}
            onChange={(e) => setEventType(e.target.value as LifecycleEventType)}
            className="rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-white"
          >
            {LIFECYCLE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t.replaceAll("_", " ")}
              </option>
            ))}
          </select>
          <MatrixButton
            type="button"
            variant="primary"
            size="sm"
            onClick={() => {
              addLifecycleEvent({
                assetId,
                type: eventType,
                occurredAt: new Date().toISOString(),
                actor: "Matrix User",
                summary: `${eventType.replaceAll("_", " ")} recorded`,
                details: "Logged from asset page",
              });
              setNotice(`Logged ${eventType}`);
              setTick((t) => t + 1);
            }}
          >
            Log event
          </MatrixButton>
        </div>
        <ol className="relative space-y-4 border-l border-slate-700 pl-6">
          {lifecycle.map((e) => (
            <li key={e.id} className="relative">
              <span className="absolute -left-[1.625rem] top-1 h-2.5 w-2.5 rounded-full bg-cyan-400" />
              <p className="text-sm font-medium text-white">
                {e.type.replaceAll("_", " ")} · {e.summary}
              </p>
              <p className="text-xs text-slate-400">
                {e.occurredAt.slice(0, 19)} · {e.actor}
              </p>
              {e.details ? <p className="text-xs text-slate-500">{e.details}</p> : null}
            </li>
          ))}
        </ol>
        <p className="mt-4 text-xs text-slate-500">
          Maintenance / parts / firmware history surfaces here via lifecycle events; Digital Twin
          pages remain the live operational twin.
        </p>
        {twinHref ? (
          <p className="mt-2 text-sm">
            <Link href={twinHref} className="text-cyan-300 hover:text-cyan-200">
              Open work-order & maintenance history on Digital Twin →
            </Link>
          </p>
        ) : null}
      </MatrixCard>
    </MatrixShell>
  );
}
