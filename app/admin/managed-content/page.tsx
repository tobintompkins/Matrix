"use client";

import { useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import AdminShell from "../../components/admin/AdminShell";
import {
  archiveManagedContent,
  createManagedContent,
  deleteDraftManagedContent,
  listManagedContent,
  publishManagedContent,
  restoreManagedContent,
  unpublishManagedContent,
  type ManagedContentKind,
  type ManagedContentVisibility,
} from "@/lib/admin/managed-content";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import { hasMatrixPermission, resolveMatrixRole } from "@/lib/auth/permissions";
import { MatrixButton } from "../../components/ui";

export default function ManagedContentPage() {
  const { user } = useUser();
  const { role } = resolveMatrixRole(
    user?.publicMetadata as Record<string, unknown> | undefined,
  );
  const canManage = hasMatrixPermission(role, "MANAGE_ADMIN_CONTENT");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<ManagedContentKind>("SYSTEM_NOTICE");
  const [visibility, setVisibility] =
    useState<ManagedContentVisibility>("INTERNAL_ONLY");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);

  const items = useMemo(() => listManagedContent(), [tick]);

  if (!canManage) {
    return (
      <AdminShell title="Managed Content">
        <p className="text-sm text-rose-300">
          You do not have permission to manage administrative content.
        </p>
      </AdminShell>
    );
  }

  const actor = {
    userId: user?.id ?? "dev-user",
    displayName: user?.fullName ?? "Matrix User",
  };

  return (
    <AdminShell
      title="Managed Content"
      subtitle="Create, preview, publish, unpublish, archive, and restore sanitized administrator-managed content. Application source code cannot be edited here."
    >
      {message ? (
        <p className="mb-3 text-sm text-emerald-300">{message}</p>
      ) : null}
      {error ? <p className="mb-3 text-sm text-rose-300">{error}</p> : null}

      <div className="mb-6 grid gap-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4 sm:grid-cols-2">
        <label className="text-sm text-slate-400">
          Title
          <input
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className="text-sm text-slate-400">
          Kind
          <select
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            value={kind}
            onChange={(e) => setKind(e.target.value as ManagedContentKind)}
          >
            <option value="DASHBOARD_ANNOUNCEMENT">Dashboard Announcement</option>
            <option value="PORTAL_ANNOUNCEMENT">Portal Announcement</option>
            <option value="HELP_TEXT">Help Text</option>
            <option value="SERVICE_INSTRUCTION">Service Instruction</option>
            <option value="PM_INSTRUCTION">PM Instruction</option>
            <option value="SYSTEM_NOTICE">System Notice</option>
            <option value="CONFIGURABLE_LABEL">Configurable Label</option>
            <option value="KNOWLEDGE_CONTENT">Knowledge Content</option>
          </select>
        </label>
        <label className="text-sm text-slate-400 sm:col-span-2">
          Body (plain text — HTML stripped)
          <textarea
            className="mt-1 min-h-28 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </label>
        <label className="text-sm text-slate-400">
          Visibility
          <select
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            value={visibility}
            onChange={(e) =>
              setVisibility(e.target.value as ManagedContentVisibility)
            }
          >
            <option value="INTERNAL_ONLY">Internal only</option>
            <option value="CUSTOMER_VISIBLE">Customer visible</option>
          </select>
        </label>
        <div className="flex items-end">
          <MatrixButton
            onClick={() => {
              setError("");
              setMessage("");
              const result = createManagedContent({
                kind,
                title,
                body,
                visibility,
                organizationId: DEFAULT_ORG_ID,
                actorUserId: actor.userId,
                actorName: actor.displayName,
              });
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setTitle("");
              setBody("");
              setMessage("Draft created.");
              setTick((n) => n + 1);
            }}
          >
            Create Draft
          </MatrixButton>
        </div>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="rounded-xl border border-slate-800 bg-slate-950/40 p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-white">{item.title}</h2>
                <p className="text-xs text-slate-500">
                  {item.kind} · {item.status} · {item.visibility}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {item.status === "DRAFT" || item.status === "UNPUBLISHED" ? (
                  <MatrixButton
                    variant="secondary"
                    onClick={() => {
                      publishManagedContent(item.id, actor);
                      setTick((n) => n + 1);
                      setMessage("Published.");
                    }}
                  >
                    Publish
                  </MatrixButton>
                ) : null}
                {item.status === "PUBLISHED" ? (
                  <MatrixButton
                    variant="secondary"
                    onClick={() => {
                      unpublishManagedContent(item.id, actor);
                      setTick((n) => n + 1);
                      setMessage("Unpublished.");
                    }}
                  >
                    Unpublish
                  </MatrixButton>
                ) : null}
                {item.status !== "ARCHIVED" ? (
                  <MatrixButton
                    variant="secondary"
                    onClick={() => {
                      const result = archiveManagedContent(
                        item.id,
                        "Archived from Managed Content",
                        actor,
                      );
                      if (!result.ok) setError(result.error);
                      else {
                        setMessage("Archived.");
                        setTick((n) => n + 1);
                      }
                    }}
                  >
                    Archive
                  </MatrixButton>
                ) : (
                  <MatrixButton
                    variant="secondary"
                    onClick={() => {
                      restoreManagedContent(item.id, actor);
                      setTick((n) => n + 1);
                      setMessage("Restored to draft.");
                    }}
                  >
                    Restore
                  </MatrixButton>
                )}
                {item.status === "DRAFT" ? (
                  <MatrixButton
                    variant="secondary"
                    onClick={() => {
                      deleteDraftManagedContent(item.id);
                      setTick((n) => n + 1);
                      setMessage("Draft deleted.");
                    }}
                  >
                    Delete Draft
                  </MatrixButton>
                ) : null}
              </div>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">
              {item.body}
            </p>
          </div>
        ))}
        {items.length === 0 ? (
          <p className="text-sm text-slate-500">No managed content yet.</p>
        ) : null}
      </div>
    </AdminShell>
  );
}
