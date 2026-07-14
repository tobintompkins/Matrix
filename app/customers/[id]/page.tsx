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
  addDocumentVersion,
  createContact,
  createSite,
  getCustomer,
  getCustomerDashboard,
  listAssets,
  listAudit,
  listChildCustomers,
  listContacts,
  listContracts,
  listDocuments,
  listSites,
} from "@/lib/crm";
import CustomerPmSummaryPanel from "@/app/components/maintenance/CustomerPmSummaryPanel";

function badge(status: string) {
  switch (status) {
    case "ACTIVE":
      return "completed" as const;
    case "EXPIRING_SOON":
    case "PROSPECT":
      return "warning" as const;
    case "EXPIRED":
    case "INACTIVE":
    case "DOWN":
      return "error" as const;
    default:
      return "offline" as const;
  }
}

export default function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [tick, setTick] = useState(0);
  const [contactName, setContactName] = useState("");
  const [siteName, setSiteName] = useState("");
  const [notice, setNotice] = useState("");

  const customer = useMemo(() => {
    void tick;
    return getCustomer(id);
  }, [id, tick]);

  const dashboard = useMemo(() => {
    void tick;
    return getCustomerDashboard(id);
  }, [id, tick]);

  const contacts = useMemo(() => {
    void tick;
    return listContacts(id);
  }, [id, tick]);

  const sites = useMemo(() => {
    void tick;
    return listSites(id).items;
  }, [id, tick]);

  const assets = useMemo(() => {
    void tick;
    return listAssets({ customerId: id }).items;
  }, [id, tick]);

  const contracts = useMemo(() => {
    void tick;
    return listContracts(id);
  }, [id, tick]);

  const documents = useMemo(() => {
    void tick;
    return listDocuments({ customerId: id });
  }, [id, tick]);

  const children = useMemo(() => {
    void tick;
    return listChildCustomers(id);
  }, [id, tick]);

  const audit = useMemo(() => {
    void tick;
    return listAudit(id, 20);
  }, [id, tick]);

  if (!customer) {
    return (
      <MatrixShell title="Customer" activePath="/customers">
        <MatrixEmptyState
          title="Customer not found"
          description="Return to the customers list."
          actionLabel="Back"
          onAction={() => {
            window.location.href = "/customers";
          }}
        />
      </MatrixShell>
    );
  }

  function refresh() {
    setTick((t) => t + 1);
  }

  return (
    <MatrixShell title={customer.name} activePath="/customers">
      <MatrixPageHeader
        title={customer.name}
        subtitle={`${customer.customerNumber} · ${customer.industry || "—"} · ${customer.timeZone}`}
        breadcrumbs={["Matrix", "Customers", customer.name]}
        actions={
          <MatrixButton href="/customers" variant="secondary" size="md">
            All customers
          </MatrixButton>
        }
      />

      {notice ? (
        <p className="mb-4 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-100">
          {notice}
        </p>
      ) : null}

      {dashboard ? (
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          <MatrixStatCard label="Sites" value={dashboard.totalSites} />
          <MatrixStatCard label="Printers" value={dashboard.totalPrinters} />
          <MatrixStatCard
            label="Fleet health"
            value={dashboard.fleetHealthPct == null ? "—" : `${dashboard.fleetHealthPct}%`}
          />
          <MatrixStatCard label="Open WOs" value={dashboard.openWorkOrders} />
          <MatrixStatCard label="Upcoming PMs" value={dashboard.upcomingPMs} />
          <MatrixStatCard label="Overdue PMs" value={dashboard.overduePMs} />
          <MatrixStatCard
            label="Monthly volume"
            value={dashboard.monthlyCopyVolume.toLocaleString()}
          />
          <MatrixStatCard label="Calls this month" value={dashboard.serviceCallsThisMonth} />
          <MatrixStatCard label="Contract" value={dashboard.contractStatus} />
          <MatrixStatCard label="Warranty alerts" value={dashboard.warrantyExpiring} />
        </div>
      ) : null}

      <CustomerPmSummaryPanel customerName={customer.name} />

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <MatrixCard title="Account" subtitle="Addresses, hours, and hierarchy.">
          <dl className="grid gap-2 text-sm text-slate-300">
            <div>
              <dt className="text-xs text-slate-500">Status</dt>
              <dd>
                <MatrixStatusBadge label={customer.status} variant={badge(customer.status)} />
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Primary address</dt>
              <dd>{customer.primaryAddress || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Billing address</dt>
              <dd>{customer.billingAddress || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Business hours</dt>
              <dd>{customer.preferredBusinessHours}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Website</dt>
              <dd>{customer.website || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Notes</dt>
              <dd>{customer.notes || "—"}</dd>
            </div>
          </dl>
          {children.length > 0 ? (
            <div className="mt-4">
              <p className="mb-2 text-xs uppercase text-slate-500">Child accounts</p>
              <ul className="space-y-1 text-sm">
                {children.map((c) => (
                  <li key={c.id}>
                    <Link href={`/customers/${c.id}`} className="text-cyan-300 hover:text-cyan-200">
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {customer.parentCustomerId ? (
            <p className="mt-3 text-sm">
              <Link
                href={`/customers/${customer.parentCustomerId}`}
                className="text-cyan-300 hover:text-cyan-200"
              >
                ← Parent company
              </Link>
            </p>
          ) : null}
        </MatrixCard>

        <MatrixCard title="Recent activity" subtitle="Lifecycle events across the fleet.">
          {dashboard?.recentActivity.length ? (
            <ul className="space-y-2 text-sm text-slate-300">
              {dashboard.recentActivity.map((a, i) => (
                <li key={i} className="border-b border-slate-800 pb-2">
                  <p>{a.label}</p>
                  <p className="text-xs text-slate-500">{a.at.slice(0, 10)}</p>
                </li>
              ))}
            </ul>
          ) : (
            <MatrixEmptyState title="No recent activity" />
          )}
        </MatrixCard>
      </div>

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <MatrixCard title="Contacts" subtitle="Primary, emergency, and notification preferences.">
          <div className="mb-4 flex gap-2">
            <input
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="New contact name"
              className="flex-1 rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-white"
            />
            <MatrixButton
              type="button"
              variant="primary"
              size="sm"
              onClick={() => {
                const r = createContact({
                  customerId: id,
                  name: contactName,
                  jobTitle: "",
                  department: "",
                  email: "",
                  officePhone: "",
                  mobilePhone: "",
                  preferredContactMethod: "EMAIL",
                  emergencyContact: false,
                  receiveServiceNotifications: true,
                  receiveMaintenanceReports: false,
                  isPrimary: contacts.length === 0,
                  notes: "",
                });
                setNotice(r.ok ? `Added contact ${r.contact?.name}` : r.error ?? "Failed");
                setContactName("");
                refresh();
              }}
            >
              Add
            </MatrixButton>
          </div>
          <ul className="divide-y divide-slate-800 text-sm">
            {contacts.map((c) => (
              <li key={c.id} className="py-2">
                <p className="font-medium text-white">
                  {c.name}
                  {c.isPrimary ? (
                    <span className="ml-2 text-xs text-cyan-400">Primary</span>
                  ) : null}
                </p>
                <p className="text-xs text-slate-400">
                  {c.jobTitle || "—"} · {c.email || "no email"} · {c.preferredContactMethod}
                </p>
              </li>
            ))}
          </ul>
        </MatrixCard>

        <MatrixCard title="Sites" subtitle="Physical locations and access instructions.">
          <div className="mb-4 flex gap-2">
            <input
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              placeholder="New site name"
              className="flex-1 rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-white"
            />
            <MatrixButton
              type="button"
              variant="primary"
              size="sm"
              onClick={() => {
                const r = createSite({
                  customerId: id,
                  siteNumber: `SITE-${Date.now().toString(36).toUpperCase()}`,
                  name: siteName,
                  physicalAddress: customer.primaryAddress,
                  latitude: null,
                  longitude: null,
                  timeZone: customer.timeZone,
                  businessHours: customer.preferredBusinessHours,
                  loadingDockInstructions: "",
                  parkingInstructions: "",
                  securityProcedures: "",
                  buildingAccessInstructions: "",
                  afterHoursAccess: "",
                  siteNotes: "",
                  assignedTechnician: "",
                });
                setNotice(r.ok ? `Added site ${r.site?.name}` : r.error ?? "Failed");
                setSiteName("");
                refresh();
              }}
            >
              Add
            </MatrixButton>
          </div>
          <ul className="divide-y divide-slate-800 text-sm">
            {sites.map((s) => (
              <li key={s.id} className="py-2">
                <Link
                  href={`/customers/${id}/sites/${s.id}`}
                  className="font-medium text-cyan-300 hover:text-cyan-200"
                >
                  {s.name}
                </Link>
                <p className="text-xs text-slate-400">
                  {s.siteNumber} · {s.physicalAddress}
                </p>
              </li>
            ))}
          </ul>
        </MatrixCard>
      </div>

      <MatrixCard title="Fleet assets" subtitle="Printers assigned to this customer." className="mb-8">
        <ul className="divide-y divide-slate-800 text-sm">
          {assets.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div>
                <Link
                  href={`/customers/${id}/assets/${a.id}`}
                  className="font-medium text-white hover:text-cyan-300"
                >
                  {a.assetNumber} · {a.nickname || a.model}
                </Link>
                <p className="text-xs text-slate-400">
                  SN {a.serialNumber} · {a.ipAddress} · QR {a.qrLabel}
                </p>
              </div>
              <MatrixStatusBadge label={a.status} variant={badge(a.status)} />
            </li>
          ))}
        </ul>
      </MatrixCard>

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <MatrixCard title="Contracts & SLAs" subtitle="Response/resolution times and inclusions.">
          <ul className="divide-y divide-slate-800 text-sm">
            {contracts.map((c) => (
              <li key={c.id} className="py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-white">{c.contractNumber}</span>
                  <MatrixStatusBadge label={c.status} variant={badge(c.status)} />
                </div>
                <p className="text-xs text-slate-400">
                  {c.startDate.slice(0, 10)} → {c.endDate.slice(0, 10)} · SLA{" "}
                  {c.slaResponseHours}h / {c.slaResolutionHours}h · {c.billingType}
                </p>
                <p className="text-xs text-slate-500">
                  PMs {c.includedPMs} · Labor {c.includedLaborHours}h · Parts{" "}
                  {c.includedParts ? "included" : "excluded"} · Excluded: {c.excludedServices || "—"}
                </p>
              </li>
            ))}
          </ul>
        </MatrixCard>

        <MatrixCard title="Documents" subtitle="Contracts, maps, manuals — with version history.">
          <ul className="divide-y divide-slate-800 text-sm">
            {documents.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div>
                  <p className="font-medium text-white">
                    {d.title}{" "}
                    <span className="text-xs text-slate-500">v{d.version}</span>
                  </p>
                  <p className="text-xs text-slate-400">
                    {d.category} · {d.fileName}
                  </p>
                </div>
                <MatrixButton
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    const r = addDocumentVersion(d.id, "Matrix User", `${d.storageRef}-v${d.version + 1}`);
                    setNotice(r.ok ? `Uploaded ${r.document?.title} v${r.document?.version}` : r.error ?? "Failed");
                    refresh();
                  }}
                >
                  New version
                </MatrixButton>
              </li>
            ))}
          </ul>
        </MatrixCard>
      </div>

      <MatrixCard title="Audit trail" subtitle="Field-level changes for this customer entity.">
        {audit.length === 0 ? (
          <p className="text-sm text-slate-400">No audited changes yet for this entity id.</p>
        ) : (
          <ul className="space-y-2 text-sm text-slate-300">
            {audit.map((a) => (
              <li key={a.id}>
                <span className="text-slate-500">{a.occurredAt.slice(0, 19)}</span> · {a.actor} ·{" "}
                {a.field}: {a.previousValue || "∅"} → {a.newValue}
              </li>
            ))}
          </ul>
        )}
      </MatrixCard>
    </MatrixShell>
  );
}
