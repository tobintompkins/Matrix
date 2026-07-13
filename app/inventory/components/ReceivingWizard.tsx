"use client";

import { useMemo, useState } from "react";
import { MatrixButton, MatrixCard } from "../../components/ui";
import {
  advanceReceiving,
  listBins,
  listWarehouses,
  startReceiving,
  updateReceivingSession,
  type ReceivingSession,
} from "@/lib/warehouse";
import { listPurchaseRequests } from "@/lib/inventory";

const STEPS = [
  "SELECT_PO",
  "RECEIVE_SHIPMENT",
  "VERIFY_QUANTITIES",
  "INSPECT_PARTS",
  "ASSIGN_LOCATIONS",
  "PRINT_LABELS",
  "COMPLETE",
] as const;

export default function ReceivingWizard({
  initialSession,
  onComplete,
}: {
  initialSession?: ReceivingSession | null;
  onComplete?: (session: ReceivingSession) => void;
}) {
  const warehouses = useMemo(() => listWarehouses(), []);
  const prs = useMemo(
    () =>
      listPurchaseRequests().filter((p) =>
        ["APPROVED", "ORDERED"].includes(p.status),
      ),
    [],
  );
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? "");
  const [prId, setPrId] = useState(prs[0]?.id ?? "");
  const [session, setSession] = useState<ReceivingSession | null>(
    initialSession ?? null,
  );
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const bins = useMemo(
    () => (session ? listBins(session.warehouseId) : []),
    [session],
  );

  function begin() {
    setError("");
    const pr = prs.find((p) => p.id === prId);
    if (!pr) {
      setError("Select a purchase order.");
      return;
    }
    const result = startReceiving({
      warehouseId,
      purchaseRequestId: pr.id,
      purchaseRequestNumber: pr.requestNumber,
      receiver: "Warehouse Receiver",
      lines: pr.lines.map((l) => ({
        partId: l.partId,
        partNumber: l.partNumber,
        description: l.description,
        expectedQty: l.quantity,
      })),
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSession(result.session);
  }

  function saveSession(next: ReceivingSession) {
    setSession(updateReceivingSession(next));
  }

  function advance() {
    if (!session) return;
    setError("");
    const result = advanceReceiving(session.id);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSession(result.session);
    if (result.session.status === "COMPLETED") {
      setNotice(`Receiving ${result.session.sessionNumber} completed.`);
      onComplete?.(result.session);
    }
  }

  const stepIndex = session
    ? Math.max(0, STEPS.indexOf(session.step as (typeof STEPS)[number]))
    : 0;

  return (
    <div className="space-y-4">
      <ol className="flex flex-wrap gap-2" aria-label="Receiving steps">
        {STEPS.map((step, i) => (
          <li
            key={step}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              i === stepIndex
                ? "bg-cyan-500/20 text-cyan-300"
                : i < stepIndex
                  ? "bg-emerald-500/15 text-emerald-300"
                  : "bg-slate-800 text-slate-500"
            }`}
          >
            {i + 1}. {step.replaceAll("_", " ")}
          </li>
        ))}
      </ol>

      {error ? (
        <p className="rounded-md bg-rose-500/10 px-3 py-2 text-sm text-rose-300" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          {notice}
        </p>
      ) : null}

      {!session ? (
        <MatrixCard>
          <h3 className="text-lg font-semibold text-slate-100">Start receiving</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-slate-400">Warehouse</span>
              <select
                className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-slate-400">Purchase order</span>
              <select
                className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                value={prId}
                onChange={(e) => setPrId(e.target.value)}
              >
                {prs.length === 0 ? (
                  <option value="">No open POs</option>
                ) : (
                  prs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.requestNumber} — {p.vendorName} ({p.status})
                    </option>
                  ))
                )}
              </select>
            </label>
          </div>
          <div className="mt-4">
            <MatrixButton type="button" onClick={begin} disabled={!prId}>
              Begin receiving wizard
            </MatrixButton>
          </div>
        </MatrixCard>
      ) : (
        <MatrixCard>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-lg font-semibold text-slate-100">
                {session.sessionNumber}
              </h3>
              <p className="text-sm text-slate-400">
                PO {session.purchaseRequestNumber} · {session.receiver}
              </p>
            </div>
            <span className="text-xs text-slate-500">{session.status}</span>
          </div>

          <ul className="mt-4 space-y-3">
            {session.lines.map((line, idx) => (
              <li
                key={line.id}
                className="rounded-lg border border-slate-800 bg-slate-950/40 p-3"
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-100">{line.partNumber}</p>
                    <p className="text-sm text-slate-400">{line.description}</p>
                  </div>
                  <p className="text-sm text-slate-400">
                    Expected {line.expectedQty}
                  </p>
                </div>

                {(session.step === "VERIFY_QUANTITIES" ||
                  session.step === "RECEIVE_SHIPMENT") && (
                  <label className="mt-2 block text-sm">
                    <span className="text-slate-500">Received qty</span>
                    <input
                      type="number"
                      min={0}
                      className="mt-1 w-28 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100"
                      value={line.receivedQty}
                      onChange={(e) => {
                        const lines = [...session.lines];
                        lines[idx] = {
                          ...line,
                          receivedQty: Number(e.target.value),
                        };
                        saveSession({ ...session, lines });
                      }}
                    />
                  </label>
                )}

                {session.step === "INSPECT_PARTS" && line.receivedQty > 0 ? (
                  <label className="mt-2 flex items-center gap-2 text-sm text-slate-300">
                    <input
                      type="checkbox"
                      checked={line.inspectedOk}
                      onChange={(e) => {
                        const lines = [...session.lines];
                        lines[idx] = {
                          ...line,
                          inspectedOk: e.target.checked,
                        };
                        saveSession({ ...session, lines });
                      }}
                    />
                    Inspection passed
                  </label>
                ) : null}

                {session.step === "ASSIGN_LOCATIONS" && line.receivedQty > 0 ? (
                  <label className="mt-2 block text-sm">
                    <span className="text-slate-500">Bin location</span>
                    <select
                      className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100"
                      value={line.binLocationId ?? ""}
                      onChange={(e) => {
                        const bin = bins.find((b) => b.id === e.target.value);
                        const lines = [...session.lines];
                        lines[idx] = {
                          ...line,
                          binLocationId: bin?.id ?? null,
                          locationCode: bin?.code ?? "",
                        };
                        saveSession({ ...session, lines });
                      }}
                    >
                      <option value="">Select bin</option>
                      {bins.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.code}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </li>
            ))}
          </ul>

          {session.step === "PRINT_LABELS" ? (
            <div className="mt-4">
              <MatrixButton
                type="button"
                variant="secondary"
                onClick={() => {
                  saveSession({ ...session, labelsPrinted: true });
                  setNotice("Labels marked as printed.");
                }}
              >
                Print labels
              </MatrixButton>
              {session.labelsPrinted ? (
                <span className="ml-3 text-sm text-emerald-300">Printed</span>
              ) : null}
            </div>
          ) : null}

          {session.status === "IN_PROGRESS" ? (
            <div className="mt-6">
              <MatrixButton type="button" onClick={advance}>
                {session.step === "PRINT_LABELS" || session.step === "COMPLETE"
                  ? "Complete receiving"
                  : "Continue"}
              </MatrixButton>
            </div>
          ) : null}
        </MatrixCard>
      )}
    </div>
  );
}
