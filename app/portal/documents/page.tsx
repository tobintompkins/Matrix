"use client";

import { useEffect, useMemo, useState } from "react";
import { MatrixButton, MatrixCard, MatrixSearchBar } from "../../components/ui";
import PortalShell from "../PortalShell";
import { listPortalDocuments } from "@/lib/portal";

type ApiDoc = {
  id: string;
  title: string;
  category: string;
  version?: string;
  description?: string;
};

export default function PortalDocumentsPage() {
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [apiDocs, setApiDocs] = useState<ApiDoc[] | null>(null);
  const localDocs = useMemo(() => listPortalDocuments({ search }), [search]);

  useEffect(() => {
    void (async () => {
      try {
        const q = search ? `?search=${encodeURIComponent(search)}` : "";
        const res = await fetch(`/api/portal/documents${q}`);
        const json = await res.json();
        if (json.ok && Array.isArray(json.items)) {
          setApiDocs(json.items as ApiDoc[]);
        }
      } catch {
        // Fall back to local list
      }
    })();
  }, [search]);

  const docs = apiDocs ?? localDocs;

  return (
    <PortalShell title="Documents">
      {notice ? <p className="mb-3 text-sm text-cyan-200">{notice}</p> : null}
      <MatrixSearchBar value={search} onValueChange={setSearch} placeholder="Search documents…" />
      <ul className="mt-4 space-y-3">
        {docs.map((d) => (
          <li key={d.id}>
            <MatrixCard
              title={d.title}
              subtitle={`${d.category}${"version" in d && d.version ? ` · v${d.version}` : ""}`}
            >
              {"description" in d && d.description ? (
                <p className="text-sm text-slate-300">{d.description}</p>
              ) : null}
              <MatrixButton
                type="button"
                variant="secondary"
                size="sm"
                className="mt-2"
                onClick={() => {
                  void (async () => {
                    try {
                      const res = await fetch(
                        `/api/portal/documents/${d.id}/download`,
                      );
                      const json = await res.json();
                      setNotice(
                        json.ok
                          ? `Authorized download recorded: ${d.title}`
                          : (json.error ?? "Download not available"),
                      );
                    } catch {
                      setNotice("Download not available");
                    }
                  })();
                }}
              >
                Download
              </MatrixButton>
            </MatrixCard>
          </li>
        ))}
      </ul>
      {docs.length === 0 ? (
        <p className="mt-6 text-sm text-slate-400">No customer documents available.</p>
      ) : null}
    </PortalShell>
  );
}
