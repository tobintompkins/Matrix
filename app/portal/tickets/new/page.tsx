"use client";

import { useMemo, useState } from "react";
import { MatrixButton, MatrixCard } from "../../../components/ui";
import PortalShell from "../../PortalShell";
import {
  createPortalTicket,
  getActiveMembership,
  listPortalPrinters,
} from "@/lib/portal";

export default function PortalNewTicketPage() {
  const membership = getActiveMembership();
  const printers = useMemo(() => listPortalPrinters(), []);
  const [printerId, setPrinterId] = useState(printers[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [impact, setImpact] = useState("Reduced performance");
  const [errorCode, setErrorCode] = useState("");
  const [operational, setOperational] = useState(true);
  const [confirmDup, setConfirmDup] = useState(false);
  const [notice, setNotice] = useState("");
  const [createdId, setCreatedId] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const result = createPortalTicket({
      printerAssetId: printerId,
      problemCategory: "OTHER",
      problemTitle: title,
      description,
      productionImpact: impact,
      machineOperational: operational,
      errorCode,
      preferredDate: new Date().toISOString().slice(0, 10),
      preferredWindow: "",
      contactName: membership?.displayName ?? "",
      contactEmail: membership?.email ?? "",
      contactPhone: membership?.phone ?? "",
      confirmSeparateProblem: confirmDup,
    });
    if (!result.ok) {
      if ("requiresConfirmation" in result && result.requiresConfirmation) {
        setConfirmDup(true);
        setNotice(result.error);
        return;
      }
      setNotice(result.error);
      return;
    }
    setCreatedId(result.ticketId);
    setNotice(`Created ${result.ticketNumber}`);
    window.location.href = `/portal/tickets/${result.ticketId}`;
  }

  return (
    <PortalShell title="Create service ticket">
      <MatrixCard title="New request" subtitle="Only authorized printers are listed.">
        {notice ? <p className="mb-3 text-sm text-cyan-200">{notice}</p> : null}
        <form onSubmit={submit} className="grid max-w-xl gap-3">
          <label className="grid gap-1 text-sm">
            <span className="text-slate-400">Printer</span>
            <select
              required
              value={printerId}
              onChange={(e) => setPrinterId(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white"
            >
              {printers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.serialNumber}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-slate-400">Problem title</span>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-slate-400">Description</span>
            <textarea
              required
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-slate-400">Production impact</span>
            <select
              value={impact}
              onChange={(e) => setImpact(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white"
            >
              <option>No production impact</option>
              <option>Reduced performance</option>
              <option>Partially operational</option>
              <option>Machine down</option>
              <option>Production stopped</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={operational}
              onChange={(e) => setOperational(e.target.checked)}
            />
            Machine is operational
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-slate-400">Error code</span>
            <input
              value={errorCode}
              onChange={(e) => setErrorCode(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white"
            />
          </label>
          {confirmDup ? (
            <label className="flex items-center gap-2 text-sm text-amber-200">
              <input
                type="checkbox"
                checked={confirmDup}
                onChange={(e) => setConfirmDup(e.target.checked)}
              />
              Confirm this is a separate problem from the open ticket
            </label>
          ) : null}
          <MatrixButton type="submit" variant="primary" size="md" disabled={!!createdId}>
            Submit ticket
          </MatrixButton>
        </form>
      </MatrixCard>
    </PortalShell>
  );
}
