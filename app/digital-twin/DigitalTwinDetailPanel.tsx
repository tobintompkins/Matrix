"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  MatrixButton,
  MatrixCard,
  MatrixEmptyState,
  MatrixStatCard,
  MatrixStatusBadge,
  type MatrixStatusVariant,
} from "@/app/components/ui";
import type {
  DigitalTwinMachine,
  MachineHealthBand,
  MachineStatus,
} from "@/lib/digital-twin/types";
import {
  getEmergencyCallForMachine,
  getLastCompletedServiceCall,
  getOpenServiceCallsForMachine,
  getServiceCallPriorityLabel,
  getServiceCallStatusLabel,
  getServiceCallsForMachine,
} from "@/lib/service-calls";
import MachineMaintenancePanel from "@/app/components/maintenance/MachineMaintenancePanel";
import MatrixAssistPanel from "@/app/components/matrix-assist/MatrixAssistPanel";

type TabId =
  | "overview"
  | "service"
  | "pm"
  | "maintenance"
  | "parts"
  | "configuration"
  | "network"
  | "notes"
  | "documents";

const tabs: Array<{ id: TabId; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "service", label: "Service History" },
  { id: "pm", label: "PM" },
  { id: "maintenance", label: "Maintenance" },
  { id: "parts", label: "Parts" },
  { id: "configuration", label: "Configuration" },
  { id: "network", label: "Network" },
  { id: "notes", label: "Notes" },
  { id: "documents", label: "Documents" },
];

function statusVariant(status: MachineStatus): MatrixStatusVariant {
  switch (status) {
    case "ONLINE":
      return "completed";
    case "DEGRADED":
    case "SERVICE_REQUIRED":
    case "INSTALLATION":
      return "warning";
    case "OFFLINE":
    case "DOWN":
      return "error";
    default:
      return "offline";
  }
}

function healthClass(band: MachineHealthBand): string {
  if(band === "UNKNOWN") return "text-slate-400";
  switch (band) {
    case "HEALTHY":
      return "text-emerald-400";
    case "WATCH":
      return "text-cyan-300";
    case "AT_RISK":
      return "text-amber-300";
    case "CRITICAL":
      return "text-rose-400";
  }
}

function formatMeter(n: number): string {
  return Number.isFinite(n)?n.toLocaleString("en-US"):"Not recorded";
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-white">{value}</p>
    </div>
  );
}

type Props = {
  machine: DigitalTwinMachine;
};

export default function DigitalTwinDetailPanel({ machine }: Props) {
  const [tab, setTab] = useState<TabId>("overview");
  const [notice, setNotice] = useState("");
  const [notes, setNotes] = useState(machine.notes);
  const [noteDraft, setNoteDraft] = useState("");
  const [status, setStatus] = useState(machine.operational.status);

  const m = machine;
  const id = m.identity.machineId;

  const relatedCalls = useMemo(() => getServiceCallsForMachine(id), [id]);
  const openCalls = useMemo(() => getOpenServiceCallsForMachine(id), [id]);
  const emergencyCall = useMemo(() => getEmergencyCallForMachine(id), [id]);
  const lastCompleted = useMemo(() => getLastCompletedServiceCall(id), [id]);

  function show(msg: string) {
    setNotice(msg);
  }

  function addNote() {
    if (!noteDraft.trim()) return;
    setNotes((current) => [
      {
        id: `${id}-note-${Date.now()}`,
        author: "Toby Tompkins",
        createdAt: new Date().toISOString().slice(0, 10),
        category: "technician",
        text: noteDraft.trim(),
      },
      ...current,
    ]);
    setNoteDraft("");
    show("Technician note added (local session only).");
  }

  return (
    <div className="space-y-6">
      {notice && (
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 px-4 py-3 text-sm text-cyan-200">
          {notice}
        </div>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link
            href="/digital-twin"
            className="text-sm text-cyan-400 hover:text-cyan-300"
          >
            ← Back to Digital Twin
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">
              {m.identity.nickname}
            </h2>
            <MatrixStatusBadge
              variant={statusVariant(status)}
              label={status}
            />
          </div>
          <p className="mt-2 font-mono text-cyan-400">{m.identity.assetTag}</p>
          <p className="mt-1 text-sm text-slate-400">
            {m.identity.printerModel} · {m.identity.serialNumber} ·{" "}
            {m.location.siteName}
          </p>
        </div>
      </div>

      <MatrixAssistPanel
        machineId={m.identity.machineId}
        defaultSymptom={
          m.alerts.find((a) => !a.resolved)?.title ??
          m.service.recentErrorCodes[0] ??
          ""
        }
        compact
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MatrixStatCard
          label="Health Score"
          value={
            <span className={healthClass(m.health.band)}>
              {Number.isFinite(m.health.score)?m.health.score:"Not verified"}
            </span>
          }
        />
        <MatrixStatCard
          label="Meter Count"
          value={formatMeter(m.operational.currentMeterCount)}
        />
        <MatrixStatCard
          label="PM Remaining"
          value={formatMeter(m.service.currentPmMeterRemaining)}
          accent={
            m.service.currentPmMeterRemaining <= 0
              ? "text-rose-400"
              : "text-white"
          }
        />
        <MatrixStatCard
          label="Open Calls"
          value={openCalls.length || m.service.openServiceCalls}
          accent={
            openCalls.length > 0 || m.service.openServiceCalls > 0
              ? "text-amber-400"
              : "text-white"
          }
        />
      </div>

      <MatrixCard title="Actions">
        <div className="flex flex-wrap gap-2">
          <MatrixButton
            href={`/service-calls/new?machineId=${m.identity.machineId}`}
            variant="primary"
            size="md"
          >
            Create Service Call
          </MatrixButton>
          <MatrixButton href="/start-pm" variant="secondary" size="md">
            Start PM
          </MatrixButton>
          <MatrixButton
            type="button"
            variant="secondary"
            size="md"
            onClick={() => {
              setTab("notes");
              show("Add a technician note in the Notes tab.");
            }}
          >
            Add Technician Note
          </MatrixButton>
          <MatrixButton
            href="/guided-diagram-ordering"
            variant="secondary"
            size="md"
          >
            Open Parts Diagram
          </MatrixButton>
          <MatrixButton
            href="/parts-order-builder"
            variant="secondary"
            size="md"
          >
            Add Part to Order
          </MatrixButton>
          <MatrixButton href="/scanner" variant="secondary" size="md">
            View Scanner
          </MatrixButton>
          <MatrixButton
            type="button"
            variant="secondary"
            size="md"
            onClick={() =>
              show("Edit Machine is a placeholder for a future form.")
            }
          >
            Edit Machine
          </MatrixButton>
          <MatrixButton
            type="button"
            variant="danger"
            size="md"
            onClick={() => {
              setStatus("DOWN");
              show("Machine marked DOWN (local session only).");
            }}
          >
            Mark Machine Down
          </MatrixButton>
          <MatrixButton
            type="button"
            variant="success"
            size="md"
            onClick={() => {
              setStatus("ONLINE");
              show("Machine returned to ONLINE (local session only).");
            }}
          >
            Return Machine to Service
          </MatrixButton>
        </div>
      </MatrixCard>

      <div className="-mx-1 flex gap-2 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === t.id
                ? "bg-cyan-500 text-slate-950"
                : "border border-slate-700 text-slate-300 hover:bg-slate-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <MatrixCard title="Machine Identity">
            <div className="grid gap-3 sm:grid-cols-2">
              <InfoRow label="Machine ID" value={m.identity.machineId} />
              <InfoRow label="Asset tag" value={m.identity.assetTag} />
              <InfoRow label="Serial number" value={m.identity.serialNumber} />
              <InfoRow label="Model" value={m.identity.printerModel} />
              <InfoRow label="Nickname" value={m.identity.nickname} />
              <InfoRow label="Manufacturer" value={m.identity.manufacturer} />
              <InfoRow
                label="Installation date"
                value={m.identity.installationDate}
              />
            </div>
          </MatrixCard>

          <MatrixCard title="Location & Assignment">
            <div className="grid gap-3 sm:grid-cols-2">
              <InfoRow label="Customer" value={m.location.customerName} />
              <InfoRow label="Site" value={m.location.siteName} />
              <InfoRow label="Building" value={m.location.building} />
              <InfoRow label="Department" value={m.location.department} />
              <InfoRow label="Floor" value={m.location.floor} />
              <InfoRow
                label="Physical location"
                value={m.location.physicalLocation}
              />
              <InfoRow
                label="Ship-to"
                value={
                  <span className="whitespace-pre-wrap">
                    {m.location.shipToAddress}
                  </span>
                }
              />
              <InfoRow label="Contact" value={m.location.primaryContact} />
              <InfoRow
                label="Assigned technician"
                value={m.assignment.assignedTechnician}
              />
              <InfoRow label="Region" value={m.assignment.assignedRegion} />
              <InfoRow
                label="Organization"
                value={m.assignment.assignedOrganization}
              />
              <InfoRow
                label="Warehouse"
                value={m.assignment.assignedWarehouse}
              />
            </div>
          </MatrixCard>

          <MatrixCard title="Health & Status">
            <p className={`text-3xl font-bold ${healthClass(m.health.band)}`}>
              {Number.isFinite(m.health.score)?m.health.score:"Not verified"}{" "}
              <span className="text-lg">{m.health.band}</span>
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Placeholder score until live telemetry is connected.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-slate-300">
              {m.health.factors.map((f) => (
                <li
                  key={f}
                  className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2"
                >
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <InfoRow
                label="Last service"
                value={m.service.lastServiceDate}
              />
              <InfoRow
                label="Next PM target"
                value={formatMeter(m.service.nextPmMeterTarget)}
              />
            </div>
          </MatrixCard>

          <MatrixCard title="Open Alerts">
            {m.alerts.filter((a) => !a.resolved).length === 0 ? (
              <MatrixEmptyState
                title="No active alerts"
                description="This machine has no unresolved alerts."
                className="py-10"
              />
            ) : (
              <ul className="space-y-3">
                {m.alerts
                  .filter((a) => !a.resolved)
                  .map((a) => (
                    <li
                      key={a.alertId}
                      className={`rounded-lg border px-4 py-3 text-sm ${
                        a.severity === "critical"
                          ? "border-rose-500/40 bg-rose-500/10 text-rose-100"
                          : a.severity === "warning"
                            ? "border-amber-500/40 bg-amber-500/10 text-amber-100"
                            : "border-slate-700 bg-slate-950/60 text-slate-200"
                      }`}
                    >
                      <p className="font-semibold">{a.title}</p>
                      <p className="mt-1 text-xs opacity-90">{a.description}</p>
                      <p className="mt-2 text-xs opacity-70">
                        {a.createdDate} · {a.type}
                      </p>
                    </li>
                  ))}
              </ul>
            )}
          </MatrixCard>
        </div>
      )}

      {tab === "service" && (
        <div className="space-y-4">
          <MatrixCard title="Service Calls (Patch 32)">
            <div className="grid gap-3 sm:grid-cols-3 text-sm">
              <InfoRow label="Open service calls" value={openCalls.length} />
              <InfoRow
                label="Emergency call"
                value={
                  emergencyCall ? (
                    <Link
                      href={`/service-calls/${emergencyCall.id}`}
                      className="text-rose-300 hover:text-rose-200"
                    >
                      {emergencyCall.workOrderNumber}
                    </Link>
                  ) : (
                    "None"
                  )
                }
              />
              <InfoRow
                label="Last completed"
                value={
                  lastCompleted ? (
                    <Link
                      href={`/service-calls/${lastCompleted.id}`}
                      className="text-cyan-300 hover:text-cyan-200"
                    >
                      {lastCompleted.workOrderNumber}
                    </Link>
                  ) : (
                    "—"
                  )
                }
              />
            </div>
            {relatedCalls.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">
                No linked service calls in sample/local data.
              </p>
            ) : (
              <ul className="mt-4 space-y-2">
                {relatedCalls.slice(0, 5).map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 px-3 py-2 text-sm"
                  >
                    <div>
                      <Link
                        href={`/service-calls/${c.id}`}
                        className="font-semibold text-cyan-300 hover:text-cyan-200"
                      >
                        {c.workOrderNumber}
                      </Link>
                      <p className="text-slate-400">{c.problem.issueTitle}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="text-xs text-slate-500">
                        {getServiceCallPriorityLabel(c.priority)}
                      </span>
                      <span className="text-xs text-slate-400">
                        {getServiceCallStatusLabel(c.status)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4">
              <MatrixButton
                href={`/service-calls/new?machineId=${id}`}
                variant="primary"
                size="md"
              >
                Create Service Call
              </MatrixButton>
            </div>
          </MatrixCard>

          <MatrixCard title="Service History">
          {m.serviceHistory.length === 0 ? (
            <MatrixEmptyState
              title="No service history"
              description="History will appear when the service database is connected."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-slate-400">
                  <tr>
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 font-medium">Summary</th>
                    <th className="px-3 py-2 font-medium">Technician</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {m.serviceHistory.map((h) => (
                    <tr
                      key={h.id}
                      className="border-t border-slate-800 text-slate-200"
                    >
                      <td className="px-3 py-3">{h.date}</td>
                      <td className="px-3 py-3">{h.type}</td>
                      <td className="px-3 py-3">{h.summary}</td>
                      <td className="px-3 py-3">{h.technician}</td>
                      <td className="px-3 py-3">{h.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <MatrixButton href="/service-calls" variant="secondary" size="md">
              Open Service Calls
            </MatrixButton>
            <MatrixButton href="/tickets" variant="secondary" size="md">
              Open Service Tickets
            </MatrixButton>
          </div>
        </MatrixCard>
        </div>
      )}

      {tab === "pm" && (
        <MatrixCard title="Preventive Maintenance">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <InfoRow label="Last PM date" value={m.service.lastPmDate} />
            <InfoRow
              label="Next PM meter target"
              value={formatMeter(m.service.nextPmMeterTarget)}
            />
            <InfoRow
              label="Current meter"
              value={formatMeter(m.operational.currentMeterCount)}
            />
            <InfoRow
              label="PM remaining"
              value={formatMeter(m.service.currentPmMeterRemaining)}
            />
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <MatrixButton href="/start-pm" variant="primary" size="md">
              Start PM
            </MatrixButton>
            <MatrixButton href="/request-pm-kit" variant="secondary" size="md">
              Request PM Kit
            </MatrixButton>
            <MatrixButton
              type="button"
              variant="secondary"
              size="md"
              onClick={() => setTab("maintenance")}
            >
              Open Machine Maintenance
            </MatrixButton>
          </div>
        </MatrixCard>
      )}

      {tab === "maintenance" && (
        <MachineMaintenancePanel printerId={id} />
      )}

      {tab === "parts" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <MatrixCard title="Currently Installed">
            <ul className="space-y-2 text-sm">
              {m.parts.currentlyInstalled.map((p) => (
                <li
                  key={`${p.partNumber}-${p.installedDate}`}
                  className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2"
                >
                  <p className="font-mono text-cyan-400">{p.partNumber}</p>
                  <p className="text-white">{p.partName}</p>
                  <p className="text-xs text-slate-500">
                    {p.installedDate} · {p.status}
                  </p>
                </li>
              ))}
            </ul>
          </MatrixCard>
          <MatrixCard title="Recent Parts Replaced">
            <ul className="space-y-2 text-sm">
              {m.parts.recentPartsReplaced.map((p) => (
                <li
                  key={`${p.partNumber}-r-${p.installedDate}`}
                  className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2"
                >
                  <p className="font-mono text-cyan-400">{p.partNumber}</p>
                  <p className="text-white">{p.partName}</p>
                  <p className="text-xs text-slate-500">{p.installedDate}</p>
                </li>
              ))}
            </ul>
          </MatrixCard>
          <MatrixCard title="Emergency Needs & Orders">
            <p className="text-sm text-slate-400">
              Open parts orders:{" "}
              <span className="font-semibold text-white">
                {m.parts.openPartsOrders}
              </span>
            </p>
            {m.parts.emergencyPartsNeeds.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">
                No emergency part needs flagged.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {m.parts.emergencyPartsNeeds.map((p) => (
                  <li
                    key={p}
                    className="rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2 font-mono text-sm text-rose-200"
                  >
                    {p}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <MatrixButton href="/inventory" variant="secondary" size="md">
                View Inventory
              </MatrixButton>
              <MatrixButton
                href={m.parts.diagramShortcut}
                variant="secondary"
                size="md"
              >
                Open Diagram
              </MatrixButton>
              <MatrixButton
                href="/parts-order-builder"
                variant="primary"
                size="md"
              >
                Add to Parts Order
              </MatrixButton>
            </div>
          </MatrixCard>
        </div>
      )}

      {tab === "configuration" && (
        <MatrixCard title="Configuration">
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoRow
              label="Accessories"
              value={m.configuration.installedAccessories.join(", ")}
            />
            <InfoRow
              label="Finishing"
              value={m.configuration.finishingOptions.join(", ")}
            />
            <InfoRow
              label="Paper feed"
              value={m.configuration.paperFeedConfiguration}
            />
            <InfoRow
              label="Output"
              value={m.configuration.outputConfiguration}
            />
            <InfoRow
              label="Controller type"
              value={m.configuration.controllerType}
            />
            <InfoRow
              label="Special config"
              value={m.configuration.specialCustomerConfiguration}
            />
            <InfoRow
              label="Paper sizes"
              value={m.configuration.supportedPaperSizes.join(", ")}
            />
          </div>
        </MatrixCard>
      )}

      {tab === "network" && (
        <MatrixCard title="Network & Controller">
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoRow
              label="Network status"
              value={m.network.networkStatus}
            />
            <InfoRow label="RRA status" value={m.network.rraStatus} />
            <InfoRow label="IP address" value={m.network.ipAddress} />
            <InfoRow label="Hostname" value={m.network.hostname} />
            <InfoRow
              label="Firmware version"
              value={m.network.firmwareVersion}
            />
            <InfoRow
              label="Controller version"
              value={m.network.controllerVersion}
            />
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Live RRA / telemetry placeholders — not connected yet.
          </p>
        </MatrixCard>
      )}

      {tab === "notes" && (
        <MatrixCard title="Notes">
          <div className="mb-4 space-y-3">
            <textarea
              rows={3}
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              placeholder="Add technician note…"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:border-cyan-500 focus:outline-none"
            />
            <MatrixButton
              type="button"
              variant="primary"
              size="md"
              onClick={addNote}
            >
              Save Note
            </MatrixButton>
          </div>
          <ul className="space-y-3">
            {notes.map((n) => (
              <li
                key={n.id}
                className="rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm"
              >
                <p className="text-xs text-slate-500">
                  {n.category} · {n.author} · {n.createdAt}
                </p>
                <p className="mt-2 text-slate-200">{n.text}</p>
              </li>
            ))}
          </ul>
        </MatrixCard>
      )}

      {tab === "documents" && (
        <MatrixCard title="Documents & Attachments">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {m.attachments.map((a) => (
              <div
                key={a.id}
                className="rounded-xl border border-dashed border-slate-700 bg-slate-950/40 px-4 py-6 text-center"
              >
                <p className="font-medium text-white">{a.label}</p>
                <p className="mt-2 text-xs text-slate-500">{a.description}</p>
                <p className="mt-2 text-xs uppercase tracking-wide text-slate-600">
                  {a.category}
                </p>
              </div>
            ))}
          </div>
        </MatrixCard>
      )}
    </div>
  );
}
