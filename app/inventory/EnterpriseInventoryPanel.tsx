"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  MatrixButton,
  MatrixCard,
  MatrixEmptyState,
  MatrixSearchBar,
  MatrixStatCard,
  MatrixStatusBadge,
} from "../components/ui";
import {
  generateInventoryReport,
  getDashboardMetrics,
  listAuditLog,
  listBalances,
  listCatalog,
  listLocations,
  listPurchaseRequests,
  listReservations,
  listTransactions,
  listVendors,
  postTransaction,
  processScan,
  quantityAvailable,
  type InventoryReportType,
  type PurchaseRequestStatus,
} from "@/lib/inventory";
import { updatePurchaseRequestStatus } from "@/lib/inventory/enterprise-repository";

type HubTab =
  | "dashboard"
  | "catalog"
  | "stock"
  | "transactions"
  | "reservations"
  | "scan"
  | "reports";

function money(n: number) {
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function prBadge(status: PurchaseRequestStatus) {
  switch (status) {
    case "APPROVED":
    case "RECEIVED":
      return "completed" as const;
    case "PENDING_APPROVAL":
    case "ORDERED":
      return "warning" as const;
    case "CANCELLED":
      return "error" as const;
    default:
      return "offline" as const;
  }
}

export default function EnterpriseInventoryPanel() {
  const [tab, setTab] = useState<HubTab>("dashboard");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [tick, setTick] = useState(0);
  const [scanCode, setScanCode] = useState("");
  const [scanMsg, setScanMsg] = useState("");
  const [reportType, setReportType] = useState<InventoryReportType>("VALUATION");
  const [notice, setNotice] = useState("");

  const metrics = useMemo(() => {
    void tick;
    return getDashboardMetrics();
  }, [tick]);

  const catalog = useMemo(() => {
    void tick;
    return listCatalog(query, page, 10);
  }, [tick, query, page]);

  const locations = useMemo(() => {
    void tick;
    return listLocations();
  }, [tick]);

  const balances = useMemo(() => {
    void tick;
    return listBalances();
  }, [tick]);

  const transactions = useMemo(() => {
    void tick;
    return listTransactions(40);
  }, [tick]);

  const reservations = useMemo(() => {
    void tick;
    return listReservations("ACTIVE");
  }, [tick]);

  const purchaseRequests = useMemo(() => {
    void tick;
    return listPurchaseRequests();
  }, [tick]);

  const vendors = useMemo(() => {
    void tick;
    return listVendors();
  }, [tick]);

  const audit = useMemo(() => {
    void tick;
    return listAuditLog(30);
  }, [tick]);

  const report = useMemo(() => {
    void tick;
    return generateInventoryReport(reportType);
  }, [tick, reportType]);

  const locationName = useMemo(() => {
    const map = new Map(locations.map((l) => [l.id, l.name]));
    return (id: string | null) => (id ? map.get(id) ?? id : "—");
  }, [locations]);

  function refresh() {
    setTick((t) => t + 1);
  }

  function runScanLookup() {
    const result = processScan({
      code: scanCode.trim(),
      action: "LOOKUP",
      user: "Toby Tompkins",
    });
    if (!result.ok) {
      setScanMsg(result.error ?? "Scan failed");
      return;
    }
    const avail = (result.balances ?? []).reduce(
      (s, b) => s + quantityAvailable(b),
      0,
    );
    setScanMsg(
      `${result.part?.partNumber} — ${result.part?.description} · Available ${avail}`,
    );
    refresh();
  }

  function quickReceiveDemo() {
    const part = catalog.items[0];
    const main = locations.find((l) => l.type === "MAIN_WAREHOUSE");
    if (!part || !main) return;
    const result = postTransaction({
      type: "RECEIVE",
      partId: part.id,
      quantity: 1,
      reason: "Quick receive from dashboard",
      user: "Warehouse",
      destinationLocationId: main.id,
    });
    setNotice(result.ok ? "Received 1 unit into main warehouse." : result.error ?? "Failed");
    refresh();
  }

  const tabs: Array<{ id: HubTab; label: string }> = [
    { id: "dashboard", label: "Dashboard" },
    { id: "catalog", label: "Catalog" },
    { id: "stock", label: "Stock" },
    { id: "transactions", label: "Transactions" },
    { id: "reservations", label: "Reservations" },
    { id: "scan", label: "Scan API" },
    { id: "reports", label: "Reports" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Enterprise Parts & Inventory</h2>
          <p className="mt-1 text-sm text-slate-400">
            Multi-location stock, reservations, purchase requests, and barcode-ready APIs.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <MatrixButton href="/inventory/truck" variant="secondary" size="sm">
            Truck Stock
          </MatrixButton>
          <MatrixButton href="/inventory/purchase-requests" variant="secondary" size="sm">
            Purchase Requests
          </MatrixButton>
          <MatrixButton href="/inventory/vendors" variant="secondary" size="sm">
            Vendors
          </MatrixButton>
          <MatrixButton href="/guided-diagram-ordering" variant="primary" size="sm">
            Guided Diagram
          </MatrixButton>
        </div>
      </div>

      {notice && (
        <p className="rounded-lg border border-cyan-800/60 bg-cyan-950/40 px-4 py-2 text-sm text-cyan-200">
          {notice}
        </p>
      )}

      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              tab === t.id
                ? "bg-cyan-600 text-white"
                : "bg-slate-900 text-slate-300 hover:bg-slate-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "dashboard" && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <MatrixStatCard label="Total Parts" value={metrics.totalParts} />
            <MatrixStatCard
              label="Inventory Value"
              value={money(metrics.inventoryValue)}
              accent="text-cyan-400"
            />
            <MatrixStatCard
              label="Low Stock"
              value={metrics.lowStock}
              accent="text-amber-400"
            />
            <MatrixStatCard
              label="Out of Stock"
              value={metrics.outOfStock}
              accent="text-rose-400"
            />
            <MatrixStatCard
              label="Backordered"
              value={metrics.backordered}
              accent="text-violet-300"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <MatrixCard title="Most Used Parts">
              <ul className="space-y-2 text-sm text-slate-300">
                {metrics.mostUsed.length === 0 && (
                  <li className="text-slate-500">No consume history yet.</li>
                )}
                {metrics.mostUsed.map((row) => (
                  <li key={row.partNumber} className="flex justify-between">
                    <span>{row.partNumber}</span>
                    <span className="text-slate-400">{row.quantity}</span>
                  </li>
                ))}
              </ul>
            </MatrixCard>
            <MatrixCard title="Slow Moving">
              <ul className="space-y-2 text-sm text-slate-300">
                {metrics.slowMoving.map((row) => (
                  <li key={row.partNumber} className="flex justify-between">
                    <span>{row.partNumber}</span>
                    <span className="text-slate-400">{row.daysSinceMove}d</span>
                  </li>
                ))}
              </ul>
            </MatrixCard>
            <MatrixCard title="Upcoming Required">
              <ul className="space-y-2 text-sm text-slate-300">
                {metrics.upcomingRequired.map((row) => (
                  <li key={`${row.partNumber}-${row.reason}`}>
                    <span className="font-medium text-white">{row.partNumber}</span>
                    <span className="mt-0.5 block text-slate-400">{row.reason}</span>
                  </li>
                ))}
              </ul>
              {metrics.inventoryAccuracy != null && (
                <p className="mt-4 text-xs text-slate-400">
                  Inventory accuracy (cycle count): {metrics.inventoryAccuracy.toFixed(1)}%
                </p>
              )}
            </MatrixCard>
          </div>

          <MatrixCard
            title="Open Purchase Requests"
            actions={
              <Link
                href="/inventory/purchase-requests"
                className="text-sm text-cyan-400 hover:underline"
              >
                View all
              </Link>
            }
          >
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-slate-400">
                  <tr>
                    <th className="pb-2 pr-4 font-medium">Request</th>
                    <th className="pb-2 pr-4 font-medium">Requester</th>
                    <th className="pb-2 pr-4 font-medium">Vendor</th>
                    <th className="pb-2 pr-4 font-medium">Status</th>
                    <th className="pb-2 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {purchaseRequests.slice(0, 5).map((pr) => (
                    <tr key={pr.id} className="border-t border-slate-800 text-slate-200">
                      <td className="py-2 pr-4">{pr.requestNumber}</td>
                      <td className="py-2 pr-4">{pr.requester}</td>
                      <td className="py-2 pr-4">{pr.vendorName || "—"}</td>
                      <td className="py-2 pr-4">
                        <MatrixStatusBadge
                          variant={prBadge(pr.status)}
                          label={pr.status.replaceAll("_", " ")}
                        />
                      </td>
                      <td className="py-2">
                        {pr.status === "PENDING_APPROVAL" && (
                          <button
                            type="button"
                            className="text-cyan-400 hover:underline"
                            onClick={() => {
                              updatePurchaseRequestStatus(pr.id, "APPROVED", "Jordan Lee");
                              setNotice(`Approved ${pr.requestNumber}`);
                              refresh();
                            }}
                          >
                            Approve
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </MatrixCard>

          <div className="flex flex-wrap gap-2">
            <MatrixButton variant="secondary" size="sm" onClick={quickReceiveDemo}>
              Demo Receive (+1)
            </MatrixButton>
            <MatrixButton variant="secondary" size="sm" onClick={refresh}>
              Refresh
            </MatrixButton>
          </div>
        </div>
      )}

      {tab === "catalog" && (
        <div className="space-y-4">
          <MatrixSearchBar
            value={query}
            onValueChange={(v) => {
              setQuery(v);
              setPage(1);
            }}
            placeholder="Search part number, description, barcode, model…"
          />
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-950 text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Part #</th>
                  <th className="px-4 py-3 font-medium">Description</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Models</th>
                  <th className="px-4 py-3 font-medium">Cost</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {catalog.items.map((p) => (
                  <tr key={p.id} className="border-t border-slate-800 text-slate-200">
                    <td className="px-4 py-3 font-mono text-cyan-300">{p.partNumber}</td>
                    <td className="px-4 py-3">{p.description}</td>
                    <td className="px-4 py-3">
                      {p.category} / {p.subcategory}
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {p.printerModels.join(", ")}
                    </td>
                    <td className="px-4 py-3">{money(p.cost)}</td>
                    <td className="px-4 py-3">
                      <MatrixStatusBadge
                        variant={p.status === "ACTIVE" ? "completed" : "offline"}
                        label={p.status}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between text-sm text-slate-400">
            <span>
              {catalog.total} parts · page {catalog.page}
            </span>
            <div className="flex gap-2">
              <MatrixButton
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </MatrixButton>
              <MatrixButton
                variant="secondary"
                size="sm"
                disabled={page * catalog.pageSize >= catalog.total}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </MatrixButton>
            </div>
          </div>
        </div>
      )}

      {tab === "stock" && (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-950 text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Part</th>
                <th className="px-4 py-3 font-medium">Location</th>
                <th className="px-4 py-3 font-medium">On Hand</th>
                <th className="px-4 py-3 font-medium">Reserved</th>
                <th className="px-4 py-3 font-medium">Available</th>
                <th className="px-4 py-3 font-medium">On Order</th>
                <th className="px-4 py-3 font-medium">Reorder</th>
              </tr>
            </thead>
            <tbody>
              {balances.map((b) => (
                <tr key={b.id} className="border-t border-slate-800 text-slate-200">
                  <td className="px-4 py-3 font-mono text-cyan-300">{b.partNumber}</td>
                  <td className="px-4 py-3">{locationName(b.locationId)}</td>
                  <td className="px-4 py-3">{b.quantityOnHand}</td>
                  <td className="px-4 py-3">{b.quantityReserved}</td>
                  <td className="px-4 py-3">{quantityAvailable(b)}</td>
                  <td className="px-4 py-3">{b.quantityOnOrder}</td>
                  <td className="px-4 py-3 text-slate-400">
                    {b.reorderPoint} / {b.reorderQuantity}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "transactions" && (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-950 text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">When</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Part</th>
                  <th className="px-4 py-3 font-medium">Qty</th>
                  <th className="px-4 py-3 font-medium">On Hand Δ</th>
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Reason</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id} className="border-t border-slate-800 text-slate-200">
                    <td className="px-4 py-3 text-slate-400">
                      {new Date(t.occurredAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">{t.type}</td>
                    <td className="px-4 py-3 font-mono text-cyan-300">{t.partNumber}</td>
                    <td className="px-4 py-3">{t.quantity}</td>
                    <td className="px-4 py-3">
                      {t.previousOnHand} → {t.newOnHand}
                    </td>
                    <td className="px-4 py-3">{t.user}</td>
                    <td className="px-4 py-3 text-slate-400">{t.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <MatrixCard title="Audit trail (immutable)">
            <p className="mb-3 text-xs text-slate-400">
              Inventory history is append-only and never deleted.
            </p>
            <ul className="max-h-48 space-y-1 overflow-y-auto text-xs text-slate-400">
              {audit.map((a) => (
                <li key={`audit-${a.id}`}>
                  [{a.type}] {a.partNumber} · {a.previousOnHand}→{a.newOnHand} · {a.user}
                </li>
              ))}
            </ul>
          </MatrixCard>
        </div>
      )}

      {tab === "reservations" && (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          {reservations.length === 0 ? (
            <MatrixEmptyState
              title="No active reservations"
              description="Reserved qty reduces Available without changing On Hand."
            />
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-950 text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Part</th>
                  <th className="px-4 py-3 font-medium">Location</th>
                  <th className="px-4 py-3 font-medium">Qty</th>
                  <th className="px-4 py-3 font-medium">Purpose</th>
                  <th className="px-4 py-3 font-medium">Related</th>
                  <th className="px-4 py-3 font-medium">By</th>
                </tr>
              </thead>
              <tbody>
                {reservations.map((r) => (
                  <tr key={r.id} className="border-t border-slate-800 text-slate-200">
                    <td className="px-4 py-3 font-mono text-cyan-300">{r.partNumber}</td>
                    <td className="px-4 py-3">{locationName(r.locationId)}</td>
                    <td className="px-4 py-3">{r.quantity}</td>
                    <td className="px-4 py-3">{r.purpose.replaceAll("_", " ")}</td>
                    <td className="px-4 py-3 text-slate-400">
                      {r.relatedRecordType} {r.relatedRecordId}
                    </td>
                    <td className="px-4 py-3">{r.reservedBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "scan" && (
        <MatrixCard title="Barcode / QR scan API (mobile-ready)">
          <p className="mb-4 text-sm text-slate-400">
            Actions: LOOKUP, COUNT, RECEIVE, ISSUE, TRANSFER, RESERVE via{" "}
            <code className="text-cyan-300">processScan()</code>.
          </p>
          <div className="flex flex-wrap gap-3">
            <input
              className="min-w-[240px] flex-1 rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-white"
              placeholder="Scan or enter barcode / part number"
              value={scanCode}
              onChange={(e) => setScanCode(e.target.value)}
            />
            <MatrixButton variant="primary" size="md" onClick={runScanLookup}>
              Lookup
            </MatrixButton>
          </div>
          {scanMsg && <p className="mt-3 text-sm text-cyan-200">{scanMsg}</p>}
          <p className="mt-4 text-xs text-slate-500">
            Try: <code>01412345001</code>, <code>QR-S-8224</code>, or{" "}
            <code>RIS-GD-FU-1201</code>
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {vendors.map((v) => (
              <div
                key={v.id}
                className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 text-sm"
              >
                <p className="font-medium text-white">
                  {v.name}{" "}
                  {v.preferred && (
                    <span className="text-xs text-cyan-400">Preferred</span>
                  )}
                </p>
                <p className="mt-1 text-slate-400">
                  Lead {v.leadTimeDays}d · On-time {Math.round(v.onTimeRate * 100)}%
                </p>
              </div>
            ))}
          </div>
        </MatrixCard>
      )}

      {tab === "reports" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(
              [
                "VALUATION",
                "USAGE_HISTORY",
                "TECHNICIAN_STOCK",
                "CUSTOMER_INVENTORY",
                "LOW_STOCK",
                "CYCLE_COUNTS",
                "TRANSACTIONS",
                "PURCHASE_REQUESTS",
                "VENDOR_PERFORMANCE",
              ] as InventoryReportType[]
            ).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setReportType(t)}
                className={`rounded-lg px-3 py-1.5 text-xs ${
                  reportType === t
                    ? "bg-cyan-600 text-white"
                    : "bg-slate-900 text-slate-300"
                }`}
              >
                {t.replaceAll("_", " ")}
              </button>
            ))}
          </div>
          <MatrixCard title={report.title}>
            {report.rows.length === 0 ? (
              <p className="text-sm text-slate-500">No rows for this report.</p>
            ) : (
              <div className="max-h-96 overflow-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="sticky top-0 bg-slate-950 text-slate-400">
                    <tr>
                      {Object.keys(report.rows[0]).map((k) => (
                        <th key={k} className="px-3 py-2 font-medium">
                          {k}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.rows.map((row, i) => (
                      <tr key={i} className="border-t border-slate-800 text-slate-200">
                        {Object.values(row).map((v, j) => (
                          <td key={j} className="px-3 py-2">
                            {String(v)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </MatrixCard>
        </div>
      )}
    </div>
  );
}
