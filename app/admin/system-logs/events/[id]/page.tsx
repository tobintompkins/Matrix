"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import AdminShell from "../../../../components/admin/AdminShell";
import { MatrixButton, MatrixCard } from "../../../../components/ui";
import {
  hasMatrixPermission,
  resolveMatrixRole,
} from "@/lib/auth/permissions";

type EventDetail = {
  id: string;
  eventType: string;
  category: string;
  severity: string;
  outcome: string;
  occurredAt: string;
  actorUserId: string | null;
  targetType: string | null;
  targetId: string | null;
  sourceModule: string | null;
  sourceRoute: string | null;
  httpMethod: string | null;
  statusCode: number | null;
  requestId: string | null;
  correlationId: string | null;
  message: string | null;
  summary: string;
  errorCode: string | null;
  metadata: Record<string, unknown> | null;
  durationMs: number | null;
  securityStatus?: string | null;
  security?: {
    status: string;
    assignedUserId: string | null;
    resolutionNote: string | null;
  } | null;
};

export default function SystemLogEventDetailPage() {
  const params = useParams<{ id: string }>();
  const { user } = useUser();
  const { role } = resolveMatrixRole(
    user?.publicMetadata as Record<string, unknown> | undefined,
  );
  const canView = hasMatrixPermission(role, "VIEW_SYSTEM_LOGS");
  const canAck = hasMatrixPermission(role, "ACKNOWLEDGE_SECURITY_EVENT");
  const canResolve = hasMatrixPermission(role, "RESOLVE_SECURITY_EVENT");
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [related, setRelated] = useState<EventDetail[]>([]);
  const [relatedNote, setRelatedNote] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [assignee, setAssignee] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const [detailRes, relatedRes] = await Promise.all([
        fetch(`/api/system-logs/events/${params.id}`, { cache: "no-store" }),
        fetch(`/api/system-logs/events/${params.id}/related`, {
          cache: "no-store",
        }),
      ]);
      const detail = await detailRes.json();
      const rel = await relatedRes.json();
      if (!detailRes.ok || !detail.ok) {
        setError("Not found.");
        setEvent(null);
        return;
      }
      setEvent(detail.event);
      if (rel.ok) {
        setRelated(rel.related ?? []);
        setRelatedNote(rel.note ?? null);
      }
    } catch {
      setError("Unable to load event.");
    }
  }, [params.id]);

  useEffect(() => {
    if (!canView) return;
    const t = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(t);
  }, [canView, load]);

  async function post(path: string, body?: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Action failed.");
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!canView) {
    return (
      <AdminShell title="Event Detail">
        <p className="text-sm text-rose-300">Permission denied.</p>
      </AdminShell>
    );
  }

  return (
    <AdminShell title="Event Detail" subtitle={event?.summary ?? "Loading…"}>
      <div className="mb-4">
        <Link href="/admin/system-logs/events">
          <MatrixButton variant="secondary">← Audit Explorer</MatrixButton>
        </Link>
      </div>
      {error ? <p className="mb-3 text-sm text-rose-300">{error}</p> : null}
      {!event ? (
        <p className="text-sm text-slate-400">Loading event…</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <MatrixCard title="Event">
            <dl className="space-y-2 text-sm">
              {(
                [
                  ["Type", event.eventType],
                  ["Category", event.category],
                  ["Severity", event.severity],
                  ["Outcome", event.outcome],
                  ["Timestamp", new Date(event.occurredAt).toLocaleString()],
                  ["Actor", event.actorUserId ?? "—"],
                  ["Target", event.targetType ? `${event.targetType}:${event.targetId}` : "—"],
                  ["Module", event.sourceModule ?? "—"],
                  ["Route", event.sourceRoute ?? "—"],
                  ["Method", event.httpMethod ?? "—"],
                  ["Status", event.statusCode ?? "—"],
                  ["Request ID", event.requestId ?? "—"],
                  ["Correlation ID", event.correlationId ?? "—"],
                  ["Error code", event.errorCode ?? "—"],
                  ["Duration ms", event.durationMs ?? "—"],
                  ["Security status", event.securityStatus ?? "—"],
                ] as Array<[string, string | number]>
              ).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2">
                  <dt className="text-slate-400">{k}</dt>
                  <dd className="max-w-[65%] truncate text-right">{String(v)}</dd>
                </div>
              ))}
              <div>
                <dt className="text-slate-400">Summary</dt>
                <dd className="mt-1">{event.summary}</dd>
              </div>
              {event.metadata ? (
                <div>
                  <dt className="text-slate-400">Metadata (redacted)</dt>
                  <dd>
                    <pre className="mt-1 max-h-64 overflow-auto rounded bg-slate-950 p-2 text-xs">
                      {JSON.stringify(event.metadata, null, 2)}
                    </pre>
                  </dd>
                </div>
              ) : null}
            </dl>
            <div className="mt-3 flex flex-wrap gap-2">
              {event.requestId ? (
                <MatrixButton
                  variant="secondary"
                  onClick={() => void navigator.clipboard.writeText(event.requestId!)}
                >
                  Copy Request ID
                </MatrixButton>
              ) : null}
              {event.correlationId ? (
                <MatrixButton
                  variant="secondary"
                  onClick={() =>
                    void navigator.clipboard.writeText(event.correlationId!)
                  }
                >
                  Copy Correlation ID
                </MatrixButton>
              ) : null}
              <Link href="/admin/approvals">
                <MatrixButton variant="secondary">Open Approvals</MatrixButton>
              </Link>
              <Link href="/admin/data-quality">
                <MatrixButton variant="secondary">Open Data Quality</MatrixButton>
              </Link>
            </div>
          </MatrixCard>

          <div className="space-y-4">
            {(event.category === "SECURITY" ||
              event.category === "AUTHORIZATION" ||
              event.securityStatus) && (
              <MatrixCard title="Security workflow">
                <label className="mb-2 block text-xs text-slate-400">
                  Note
                  <textarea
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
                    rows={3}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </label>
                <label className="mb-3 block text-xs text-slate-400">
                  Assign investigator (user id)
                  <input
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
                    value={assignee}
                    onChange={(e) => setAssignee(e.target.value)}
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  {canAck ? (
                    <>
                      <MatrixButton
                        disabled={busy}
                        onClick={() =>
                          void post(
                            `/api/system-logs/security/${event.id}/acknowledge`,
                          )
                        }
                      >
                        Acknowledge
                      </MatrixButton>
                      <MatrixButton
                        variant="secondary"
                        disabled={busy || !assignee}
                        onClick={() =>
                          void post(
                            `/api/system-logs/security/${event.id}/assign`,
                            { assignedUserId: assignee },
                          )
                        }
                      >
                        Assign Investigator
                      </MatrixButton>
                      <MatrixButton
                        variant="secondary"
                        disabled={busy}
                        onClick={() =>
                          void post(
                            `/api/system-logs/security/${event.id}/investigate`,
                          )
                        }
                      >
                        Start Investigation
                      </MatrixButton>
                    </>
                  ) : null}
                  {canResolve ? (
                    <>
                      <MatrixButton
                        disabled={busy || !note.trim()}
                        onClick={() =>
                          void post(
                            `/api/system-logs/security/${event.id}/resolve`,
                            { note },
                          )
                        }
                      >
                        Resolve
                      </MatrixButton>
                      <MatrixButton
                        variant="secondary"
                        disabled={busy || !note.trim()}
                        onClick={() =>
                          void post(
                            `/api/system-logs/security/${event.id}/dismiss`,
                            { note },
                          )
                        }
                      >
                        Dismiss
                      </MatrixButton>
                      <MatrixButton
                        variant="secondary"
                        disabled={busy || !note.trim()}
                        onClick={() =>
                          void post(
                            `/api/system-logs/security/${event.id}/false-positive`,
                            { note },
                          )
                        }
                      >
                        Mark False Positive
                      </MatrixButton>
                    </>
                  ) : null}
                </div>
              </MatrixCard>
            )}

            <MatrixCard title="Correlated events">
              {relatedNote ? (
                <p className="mb-2 text-sm text-slate-400">{relatedNote}</p>
              ) : null}
              <ul className="space-y-2 text-sm">
                {related.length === 0 ? (
                  <li className="text-slate-400">No related events found.</li>
                ) : (
                  related.map((r) => (
                    <li key={r.id}>
                      <Link
                        className="text-sky-300 hover:underline"
                        href={`/admin/system-logs/events/${r.id}`}
                      >
                        [{r.category}] {r.summary || r.eventType}
                      </Link>
                    </li>
                  ))
                )}
              </ul>
            </MatrixCard>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
