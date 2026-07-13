"use client";

import { useMemo, useState } from "react";
import { MatrixButton, MatrixCard, MatrixSearchBar } from "../../components/ui";
import PortalShell from "../PortalShell";
import { downloadPortalDocument, listPortalDocuments } from "@/lib/portal";

export default function PortalDocumentsPage() {
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const docs = useMemo(() => listPortalDocuments({ search }), [search]);

  return (
    <PortalShell title="Documents">
      {notice ? <p className="mb-3 text-sm text-cyan-200">{notice}</p> : null}
      <MatrixSearchBar value={search} onValueChange={setSearch} placeholder="Search documents…" />
      <ul className="mt-4 space-y-3">
        {docs.map((d) => (
          <li key={d.id}>
            <MatrixCard title={d.title} subtitle={`${d.category} · v${d.version}`}>
              <p className="text-sm text-slate-300">{d.description}</p>
              <MatrixButton
                type="button"
                variant="secondary"
                size="sm"
                className="mt-2"
                onClick={() => {
                  const r = downloadPortalDocument(d.id);
                  setNotice(r.ok ? `Download recorded: ${d.title}` : r.error ?? "Denied");
                }}
              >
                Download
              </MatrixButton>
            </MatrixCard>
          </li>
        ))}
      </ul>
    </PortalShell>
  );
}
