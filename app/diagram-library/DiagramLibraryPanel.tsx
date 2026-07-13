"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { getSampleWorkflowContext } from "@/lib/context/sample-context";
import {
  diagramCategories,
  diagramRecords,
  modelCounts,
  partCategories,
  partImageRecords,
  printerModels,
} from "@/lib/diagram-library/data";
import type {
  DiagramCategory,
  PartCategory,
  PrinterModel,
} from "@/lib/diagram-library/types";
import { buildWorkflowUrl } from "@/lib/workflow/routes";

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900">
      <div className="border-b border-slate-800 px-6 py-4">
        <h3 className="text-xl font-bold">{title}</h3>
        {description && (
          <p className="mt-2 text-sm text-slate-400">{description}</p>
        )}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

const inputClassName =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-white placeholder:text-slate-600 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500";

export default function DiagramLibraryPanel() {
  const workflowCtx = getSampleWorkflowContext();
  const [search, setSearch] = useState("");
  const [modelFilter, setModelFilter] = useState<PrinterModel>("All");
  const [assemblyFilter, setAssemblyFilter] = useState<DiagramCategory | "All">(
    "All",
  );
  const [partCategoryFilter, setPartCategoryFilter] =
    useState<PartCategory>("All");
  const [activeCategory, setActiveCategory] = useState<DiagramCategory | null>(
    null,
  );
  const [notice, setNotice] = useState("");

  const filteredDiagrams = useMemo(() => {
    const query = search.trim().toLowerCase();
    return diagramRecords.filter((diagram) => {
      const matchesSearch =
        !query ||
        diagram.name.toLowerCase().includes(query) ||
        diagram.assembly.toLowerCase().includes(query) ||
        diagram.model.toLowerCase().includes(query);
      const matchesModel =
        modelFilter === "All" || diagram.model === modelFilter;
      const matchesAssembly =
        assemblyFilter === "All" || diagram.assembly === assemblyFilter;
      const matchesCategory =
        !activeCategory || diagram.assembly === activeCategory;
      return matchesSearch && matchesModel && matchesAssembly && matchesCategory;
    });
  }, [search, modelFilter, assemblyFilter, activeCategory]);

  const filteredParts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return partImageRecords.filter((part) => {
      const matchesSearch =
        !query ||
        part.partName.toLowerCase().includes(query) ||
        part.partNumber.toLowerCase().includes(query) ||
        part.compatibleModel.toLowerCase().includes(query);
      const matchesModel =
        modelFilter === "All" || part.compatibleModel === modelFilter;
      const matchesCategory =
        partCategoryFilter === "All" || part.category === partCategoryFilter;
      return matchesSearch && matchesModel && matchesCategory;
    });
  }, [search, modelFilter, partCategoryFilter]);

  const guidedDiagramHref = buildWorkflowUrl(
    "/guided-diagram-ordering",
    workflowCtx,
  );
  const partsOrderBuilderHref = buildWorkflowUrl(
    "/parts-order-builder",
    workflowCtx,
  );
  const knowledgeBaseHref = buildWorkflowUrl("/knowledge-base", workflowCtx);

  function showPlaceholder(action: string) {
    setNotice(
      `${action} is a placeholder. Diagram files and images coming in a future release.`,
    );
  }

  return (
    <div className="space-y-8">
      {notice && (
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 px-6 py-4 text-sm text-cyan-200">
          {notice}
        </div>
      )}

      <SectionCard
        title="Library Header"
        description="Search and filter diagrams, assemblies, and part references."
      >
        <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-4">
          <div className="xl:col-span-2">
            <label className="mb-2 block text-sm text-slate-400">
              Search diagrams
            </label>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by diagram name, part, or assembly…"
              className={inputClassName}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-400">
              Filter by printer model
            </label>
            <select
              value={modelFilter}
              onChange={(e) =>
                setModelFilter(e.target.value as PrinterModel)
              }
              className={inputClassName}
            >
              <option value="All">All models</option>
              {printerModels.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-400">
              Filter by assembly / section
            </label>
            <select
              value={assemblyFilter}
              onChange={(e) =>
                setAssemblyFilter(e.target.value as DiagramCategory | "All")
              }
              className={inputClassName}
            >
              <option value="All">All assemblies</option>
              {diagramCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2 xl:col-span-4">
            <label className="mb-2 block text-sm text-slate-400">
              Filter by part category
            </label>
            <select
              value={partCategoryFilter}
              onChange={(e) =>
                setPartCategoryFilter(e.target.value as PartCategory)
              }
              className={inputClassName}
            >
              {partCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Model Filters"
        description="Quick filter by supported printer model families."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          {printerModels.map((model) => (
            <button
              key={model}
              type="button"
              onClick={() =>
                setModelFilter((current) =>
                  current === model ? "All" : model,
                )
              }
              className={`rounded-xl border px-5 py-6 text-left transition ${
                modelFilter === model
                  ? "border-cyan-500 bg-cyan-500/10"
                  : "border-slate-700 bg-slate-950/60 hover:border-slate-600 hover:bg-slate-800"
              }`}
            >
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                Printer Model
              </p>
              <p
                className={`mt-2 text-2xl font-bold ${
                  modelFilter === model ? "text-cyan-300" : "text-white"
                }`}
              >
                {model}
              </p>
              <p className="mt-2 text-sm text-slate-400">
                {modelCounts[model]} diagrams
              </p>
            </button>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Diagram Categories"
        description="Browse assembly sections and diagram groupings."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {diagramCategories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() =>
                setActiveCategory((current) =>
                  current === category ? null : category,
                )
              }
              className={`rounded-lg border px-4 py-3 text-left text-sm font-medium transition ${
                activeCategory === category
                  ? "border-cyan-500 bg-cyan-500/10 text-cyan-300"
                  : "border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700 hover:bg-slate-800"
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Diagram Gallery"
        description={`${filteredDiagrams.length} diagram(s) matching current filters.`}
      >
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {filteredDiagrams.map((diagram) => (
            <div
              key={diagram.id}
              className="flex flex-col rounded-xl border border-slate-800 bg-slate-950/60"
            >
              <div className="flex h-40 items-center justify-center border-b border-slate-800 bg-slate-900/80">
                <div className="text-center">
                  <span className="text-5xl text-slate-700" aria-hidden>
                    ◫
                  </span>
                  <p className="mt-2 text-xs text-slate-600">
                    Diagram placeholder
                  </p>
                </div>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <h4 className="font-semibold text-white">{diagram.name}</h4>
                <dl className="mt-3 space-y-1 text-sm text-slate-400">
                  <div className="flex justify-between gap-2">
                    <dt>Model</dt>
                    <dd className="text-cyan-400">{diagram.model}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>Assembly</dt>
                    <dd className="text-slate-300">{diagram.assembly}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>Callouts</dt>
                    <dd>{diagram.calloutCount}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>Last updated</dt>
                    <dd>{diagram.lastUpdated}</dd>
                  </div>
                </dl>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => showPlaceholder(`View Diagram: ${diagram.name}`)}
                    className="rounded-lg border border-cyan-500/50 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-300 hover:bg-cyan-500/20"
                  >
                    View Diagram
                  </button>
                  <Link
                    href={guidedDiagramHref}
                    className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800"
                  >
                    Order Parts
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Part Image Gallery"
        description={`${filteredParts.length} part reference(s) matching current filters.`}
      >
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredParts.map((part) => (
            <div
              key={part.id}
              className="flex flex-col rounded-xl border border-slate-800 bg-slate-950/60"
            >
              <div className="flex h-32 items-center justify-center border-b border-slate-800 bg-slate-900/80">
                <div className="text-center">
                  <span className="text-4xl text-slate-700" aria-hidden>
                    ▣
                  </span>
                  <p className="mt-1 text-xs text-slate-600">Part image</p>
                </div>
              </div>
              <div className="flex flex-1 flex-col p-4">
                <h4 className="font-medium text-white">{part.partName}</h4>
                <p className="mt-1 font-mono text-xs text-cyan-400">
                  {part.partNumber}
                </p>
                <p className="mt-2 text-sm text-slate-400">
                  {part.compatibleModel}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      showPlaceholder(`View Details: ${part.partName}`)
                    }
                    className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800"
                  >
                    View Details
                  </button>
                  <Link
                    href={partsOrderBuilderHref}
                    className="rounded-lg border border-cyan-500/50 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-300 hover:bg-cyan-500/20"
                  >
                    Add to Order
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Actions" description="Continue parts and knowledge workflows.">
        <div className="flex flex-wrap gap-4">
          <Link
            href={guidedDiagramHref}
            className="rounded-xl bg-cyan-500 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400"
          >
            Open Guided Diagram Ordering
          </Link>
          <Link
            href={partsOrderBuilderHref}
            className="rounded-xl border border-cyan-500/50 bg-cyan-500/10 px-6 py-3 font-semibold text-cyan-300 transition hover:bg-cyan-500/20"
          >
            Open Parts Order Builder
          </Link>
          <Link
            href={knowledgeBaseHref}
            className="rounded-xl border border-slate-600 px-6 py-3 font-semibold text-slate-200 transition hover:border-cyan-500 hover:text-cyan-300"
          >
            Open Knowledge Base
          </Link>
        </div>
        <p className="mt-4 text-xs text-slate-500">
          Real diagram files, part images, and database integration coming in
          future releases.
        </p>
      </SectionCard>
    </div>
  );
}
