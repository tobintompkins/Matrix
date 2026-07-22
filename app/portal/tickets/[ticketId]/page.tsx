"use client";

import { use, useMemo, useState } from "react";
import {
  MatrixButton,
  MatrixCard,
  MatrixEmptyState,
} from "../../../components/ui";
import PortalShell from "../../PortalShell";
import {
  addPortalMessage,
  approvePortalWork,
  getPortalTicket,
  submitPortalFeedback,
} from "@/lib/portal";

export default function PortalTicketDetailPage({
  params,
}: {
  params: Promise<{ ticketId: string }>;
}) {
  const { ticketId } = use(params);
  const [tick, setTick] = useState(0);
  const [message, setMessage] = useState("");
  const [signature, setSignature] = useState("");
  const [notice, setNotice] = useState("");
  const [rating, setRating] = useState(5);
  const [uploading, setUploading] = useState(false);

  const detail = useMemo(() => {
    void tick;
    return getPortalTicket(ticketId);
  }, [ticketId, tick]);

  if (!detail.ok) {
    return (
      <PortalShell title="Ticket">
        <MatrixEmptyState title="Access denied" description={detail.error} />
      </PortalShell>
    );
  }

  const t = detail.ticket;

  return (
    <PortalShell title={t.ticketNumber}>
      {notice ? (
        <p className="mb-4 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100">
          {notice}
        </p>
      ) : null}

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <MatrixCard title="Ticket summary">
          <dl className="space-y-2 text-sm text-slate-300">
            <div>
              <dt className="text-xs text-slate-500">Status</dt>
              <dd className="text-white">{t.customerStatus}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Problem</dt>
              <dd>{t.problemTitle}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Printer</dt>
              <dd>{t.printerLabel}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Location</dt>
              <dd>{t.locationName}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Technician</dt>
              <dd>{t.technicianName || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Scheduled</dt>
              <dd>{t.scheduledWindow || "—"}</dd>
            </div>
            {t.partsDelay ? (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-amber-100">
                {t.partsDelay}
              </div>
            ) : null}
          </dl>
        </MatrixCard>

        <MatrixCard title="Activity" subtitle="Customer-visible updates only">
          <ol className="space-y-2 border-l border-slate-700 pl-4 text-sm">
            {detail.activity.map((a, i) => (
              <li key={i}>
                <p className="text-white">
                  {a.label}
                  {a.code ? (
                    <span className="ml-2 text-[10px] uppercase text-slate-500">
                      {a.code}
                    </span>
                  ) : null}
                </p>
                <p className="text-xs text-slate-400">
                  {a.at.slice(0, 19)} — {a.message}
                </p>
              </li>
            ))}
            {detail.activity.length === 0 ? (
              <li className="text-slate-400">No customer-visible updates yet.</li>
            ) : null}
          </ol>
        </MatrixCard>
      </div>

      <MatrixCard title="Messages" className="mb-6">
        <ul className="mb-3 space-y-2 text-sm">
          {detail.messages.map((m) => (
            <li key={m.id} className="rounded-lg border border-slate-800 p-2">
              <p className="font-medium text-white">{m.senderDisplayName}</p>
              <p className="text-slate-300">{m.body}</p>
              <p className="text-xs text-slate-500">{m.createdAt.slice(0, 19)}</p>
            </li>
          ))}
        </ul>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          className="mb-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
          placeholder="Add a message for the service team…"
        />
        <div className="flex flex-wrap items-center gap-3">
          <MatrixButton
            type="button"
            variant="primary"
            size="md"
            onClick={() => {
              const r = addPortalMessage({ ticketId, body: message });
              setNotice(r.ok ? "Message sent" : r.error ?? "Failed");
              setMessage("");
              setTick((x) => x + 1);
            }}
          >
            Send message
          </MatrixButton>
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-300">
            <span className="rounded-lg border border-slate-600 px-3 py-2 hover:border-cyan-500">
              {uploading ? "Uploading…" : "Attach file"}
            </span>
            <input
              type="file"
              className="sr-only"
              accept="image/jpeg,image/png,image/webp,application/pdf,text/plain"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                void (async () => {
                  setUploading(true);
                  try {
                    const form = new FormData();
                    form.append("file", file);
                    if (message.trim()) form.append("caption", message.trim());
                    const res = await fetch(
                      `/api/portal/service-requests/${ticketId}/attachments`,
                      { method: "POST", body: form },
                    );
                    const json = await res.json();
                    setNotice(
                      json.ok
                        ? `Uploaded ${json.attachment?.fileName ?? file.name}`
                        : (json.error ?? "Upload failed"),
                    );
                    if (json.ok) {
                      setMessage("");
                      setTick((x) => x + 1);
                    }
                  } catch {
                    setNotice("Upload failed");
                  } finally {
                    setUploading(false);
                  }
                })();
              }}
            />
          </label>
        </div>
      </MatrixCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <MatrixCard title="Approve completed work">
          <p className="mb-2 text-sm text-slate-300">
            {t.resolutionSummary || "Resolution will appear when the technician completes work."}
          </p>
          <input
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            placeholder="Type your name to sign"
            className="mb-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
          />
          <div className="flex flex-wrap gap-2">
            <MatrixButton
              type="button"
              variant="success"
              size="md"
              onClick={() => {
                const r = approvePortalWork({
                  ticketId,
                  signature,
                });
                setNotice(r.ok ? "Work approved" : r.error ?? "Failed");
                setTick((x) => x + 1);
              }}
            >
              Approve
            </MatrixButton>
            <MatrixButton
              type="button"
              variant="danger"
              size="md"
              onClick={() => {
                const r = approvePortalWork({
                  ticketId,
                  signature: "",
                  unresolved: true,
                  comment: "Issue not resolved",
                });
                setNotice(r.ok ? "Follow-up requested" : r.error ?? "Failed");
                setTick((x) => x + 1);
              }}
            >
              Not resolved
            </MatrixButton>
          </div>
        </MatrixCard>

        <MatrixCard title="Feedback">
          <label className="mb-2 block text-sm text-slate-400">
            Rating
            <input
              type="number"
              min={1}
              max={5}
              value={rating}
              onChange={(e) => setRating(Number(e.target.value))}
              className="ml-2 w-16 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-white"
            />
          </label>
          <MatrixButton
            type="button"
            variant="secondary"
            size="md"
            onClick={() => {
              const r = submitPortalFeedback({
                ticketId,
                rating,
                resolutionSatisfaction: rating,
                technicianProfessionalism: rating,
                communicationQuality: rating,
                responseTimeSatisfaction: rating,
                comment: "",
                followUpRequested: rating <= 2,
              });
              setNotice(r.ok ? "Feedback submitted" : r.error ?? "Failed");
            }}
          >
            Submit feedback
          </MatrixButton>
        </MatrixCard>
      </div>
    </PortalShell>
  );
}
