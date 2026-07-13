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
  createCustomer,
  crmSearch,
  listCustomers,
  listExpiringContracts,
  listSites,
  lookupAssetByScan,
  runCrmReport,
  type CrmReportType,
  type CustomerStatus,
} from "@/lib/crm";

type HubTab = "accounts" | "search" | "scan" | "reports" | "contracts";

function statusBadge(status: string) {
  switch (status) {
    case "ACTIVE":
      return "completed" as const;
    case "EXPIRING_SOON":
    case "PROSPECT":
      return "warning" as const;
    case "EXPIRED":
    case "INACTIVE":
      return "error" as const;
    default:
      return "offline" as const;
  }
}

const REPORT_TYPES: CrmReportType[] = [
  "FLEET_HEALTH",
  "CUSTOMER_INVENTORY",
  "WARRANTY_EXPIRATION",
  "CONTRACT_EXPIRATION",
  "ASSET_AGE",
  "PM_COMPLIANCE",
  "SERVICE_HISTORY",
  "PRINTER_UTILIZATION",
];

export default function EnterpriseCrmPanel() {
  const [tab, setTab] = useState<HubTab>("accounts");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [tick, setTick] = useState(0);
  const [scanCode, setScanCode] = useState("");
  const [scanMsg, setScanMsg] = useState("");
  const [reportType, setReportType] = useState<CrmReportType>("CUSTOMER_INVENTORY");
  const [notice, setNotice] = useState("");
  const [newName, setNewName] = useState("");
  const [newNumber, setNewNumber] = useState("");

  const customers = useMemo(() => {
    void tick;
    return listCustomers(page, 25);
  }, [tick, page]);

  const sitesTotal = useMemo(() => {
    void tick;
    return listSites(undefined, 1, 1).total;
  }, [tick]);

  const expiring = useMemo(() => {
    void tick;
    return listExpiringContracts(90);
  }, [tick]);

  const searchHits = useMemo(() => {
    void tick;
    if (!query.trim()) return { hits: [], total: 0 };
    return crmSearch(query, 1, 40);
  }, [tick, query]);

  const report = useMemo(() => {
    void tick;
    return runCrmReport(reportType);
  }, [tick, reportType]);

  const activeCount = customers.items.filter((c) => c.status === "ACTIVE").length;

  function refresh() {
    setTick((t) => t + 1);
  }

  function handleCreate() {
    const result = createCustomer({
      customerNumber: newNumber.trim() || `CUST-${Date.now().toString(36).toUpperCase()}`,
      name: newName.trim(),
      status: "PROSPECT" as CustomerStatus,
      industry: "",
      parentCustomerId: null,
      taxId: null,
      billingAddress: "",
      primaryAddress: "",
      notes: "",
      website: "",
      timeZone: "America/New_York",
      preferredBusinessHours: "Mon–Fri 08:00–17:00",
    });
    if (!result.ok) {
      setNotice(result.error ?? "Could not create customer.");
      return;
    }
    setNotice(`Created ${result.customer?.name}.`);
    setNewName("");
    setNewNumber("");
    refresh();
  }

  function handleScan() {
    const asset = lookupAssetByScan(scanCode);
    if (!asset) {
      setScanMsg("No asset matched that QR / barcode / serial.");
      return;
    }
    setScanMsg(`Matched ${asset.assetNumber} — opening profile…`);
    window.location.href = `/customers/${asset.customerId}/assets/${asset.id}`;
  }

  const tabs: Array<{ id: HubTab; label: string }> = [
    { id: "accounts", label: "Accounts" },
    { id: "search", label: "Search" },
    { id: "scan", label: "QR / Barcode" },
    { id: "contracts", label: "Contracts" },
    { id: "reports", label: "Reports" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MatrixStatCard label="Customers" value={customers.total} />
        <MatrixStatCard label="Active (page)" value={activeCount} />
        <MatrixStatCard label="Sites" value={sitesTotal} />
        <MatrixStatCard label="Contracts expiring ≤90d" value={expiring.length} />
      </div>

      {notice ? (
        <p className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-100">
          {notice}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              tab === t.id
                ? "bg-cyan-500/20 text-cyan-200 ring-1 ring-cyan-400/40"
                : "bg-slate-800/60 text-slate-300 hover:bg-slate-700/60"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "accounts" ? (
        <MatrixCard
          title="Enterprise accounts"
          subtitle="Parent/child customers, sites, and fleet assets."
        >
          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Customer name"
              className="rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-white"
            />
            <input
              value={newNumber}
              onChange={(e) => setNewNumber(e.target.value)}
              placeholder="Customer number (optional)"
              className="rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-white"
            />
            <MatrixButton type="button" variant="primary" size="md" onClick={handleCreate}>
              Quick add
            </MatrixButton>
          </div>

          {customers.items.length === 0 ? (
            <MatrixEmptyState title="No customers" description="Add an account to get started." />
          ) : (
            <ul className="divide-y divide-slate-800">
              {customers.items.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div>
                    <Link
                      href={`/customers/${c.id}`}
                      className="font-medium text-white hover:text-cyan-300"
                    >
                      {c.name}
                    </Link>
                    <p className="text-xs text-slate-400">
                      {c.customerNumber}
                      {c.parentCustomerId ? " · Division" : ""}
                      {c.industry ? ` · ${c.industry}` : ""}
                    </p>
                  </div>
                  <MatrixStatusBadge label={c.status} variant={statusBadge(c.status)} />
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 flex items-center justify-between text-sm text-slate-400">
            <span>
              Page {customers.page} · {customers.total} total
            </span>
            <div className="flex gap-2">
              <MatrixButton
                type="button"
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </MatrixButton>
              <MatrixButton
                type="button"
                variant="secondary"
                size="sm"
                disabled={page * customers.pageSize >= customers.total}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </MatrixButton>
            </div>
          </div>
        </MatrixCard>
      ) : null}

      {tab === "search" ? (
        <MatrixCard title="CRM search" subtitle="Customer, site, asset, contact, contract, IP, hostname.">
          <MatrixSearchBar
            value={query}
            onValueChange={setQuery}
            placeholder="Search customers, sites, serials, contracts…"
          />
          {searchHits.hits.length === 0 ? (
            <div className="mt-4">
              <MatrixEmptyState
                title={query ? "No matches" : "Enter a query"}
                description="Indexed lookups across CRM entities."
              />
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-slate-800">
              {searchHits.hits.map((h) => (
                <li key={`${h.kind}-${h.id}`} className="py-3">
                  <Link href={h.href} className="font-medium text-cyan-300 hover:text-cyan-200">
                    [{h.kind}] {h.label}
                  </Link>
                  <p className="text-xs text-slate-400">{h.subtitle}</p>
                </li>
              ))}
            </ul>
          )}
        </MatrixCard>
      ) : null}

      {tab === "scan" ? (
        <MatrixCard
          title="QR & barcode lookup"
          subtitle="Architecture for future mobile camera scan — paste or type a label code today."
        >
          <div className="flex flex-wrap gap-3">
            <input
              value={scanCode}
              onChange={(e) => setScanCode(e.target.value)}
              placeholder="QR-MX-GD-002 or barcode / serial"
              className="min-w-[240px] flex-1 rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-white"
            />
            <MatrixButton type="button" variant="primary" size="md" onClick={handleScan}>
              Open asset
            </MatrixButton>
          </div>
          {scanMsg ? <p className="mt-3 text-sm text-slate-300">{scanMsg}</p> : null}
          <p className="mt-4 text-xs text-slate-500">
            Printable labels use asset <code className="text-slate-300">qrLabel</code>. Camera
            integration can call the same <code className="text-slate-300">lookupAssetByScan</code>{" "}
            resolver.
          </p>
        </MatrixCard>
      ) : null}

      {tab === "contracts" ? (
        <MatrixCard
          title="Contract expiration watch"
          subtitle="Managers are warned when contracts approach expiration (≤90 days)."
        >
          {expiring.length === 0 ? (
            <MatrixEmptyState title="No soon-to-expire contracts" description="All clear within 90 days." />
          ) : (
            <ul className="divide-y divide-slate-800">
              {expiring.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <Link
                      href={`/customers/${c.customerId}`}
                      className="font-medium text-white hover:text-cyan-300"
                    >
                      {c.contractNumber}
                    </Link>
                    <p className="text-xs text-slate-400">Ends {c.endDate.slice(0, 10)}</p>
                  </div>
                  <MatrixStatusBadge label={c.status} variant={statusBadge(c.status)} />
                </li>
              ))}
            </ul>
          )}
        </MatrixCard>
      ) : null}

      {tab === "reports" ? (
        <MatrixCard title="CRM reports" subtitle="Fleet, warranty, contracts, utilization, and more.">
          <div className="mb-4 flex flex-wrap gap-2">
            {REPORT_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setReportType(t)}
                className={`rounded-md px-2.5 py-1 text-xs ${
                  reportType === t
                    ? "bg-cyan-500/20 text-cyan-200"
                    : "bg-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                {t.replaceAll("_", " ")}
              </button>
            ))}
          </div>
          <h3 className="mb-2 text-sm font-semibold text-white">{report.title}</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  {report.rows[0]
                    ? Object.keys(report.rows[0]).map((k) => (
                        <th key={k} className="px-2 py-2">
                          {k}
                        </th>
                      ))
                    : null}
                </tr>
              </thead>
              <tbody className="text-slate-300">
                {report.rows.slice(0, 40).map((row, i) => (
                  <tr key={i} className="border-t border-slate-800">
                    {Object.values(row).map((v, j) => (
                      <td key={j} className="px-2 py-2">
                        {String(v)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </MatrixCard>
      ) : null}
    </div>
  );
}
