"use client";

import { useMemo, useState } from "react";
import {
  EnterpriseTableToolbar,
  MatrixButton,
  MatrixCard,
  MatrixEmptyState,
  MatrixStatCard,
  MatrixStatusBadge,
  exportRowsAsCsv,
  type MatrixStatusVariant,
} from "@/app/components/ui";
import {
  compatibleModels,
  getDefaultTruckLocation,
  getDefaultWarehouseLocation,
  sampleInventoryItems,
} from "@/lib/inventory/data";
import {
  createDraftTransfer,
  createPartsOrderDraftLine,
  deriveStockStatus,
  INVENTORY_INTEGRATION_PLACEHOLDERS,
} from "@/lib/inventory/helpers";
import type {
  CompatibleModel,
  EmergencyStockRequest,
  InventoryItem,
  InventoryLocationType,
  InventoryTransfer,
  PartsOrderDraftLine,
  StockStatus,
} from "@/lib/inventory/types";

function stockStatusVariant(status: StockStatus): MatrixStatusVariant {
  switch (status) {
    case "In Stock":
      return "completed";
    case "Low Stock":
      return "warning";
    case "Out of Stock":
      return "error";
    default:
      return "offline";
  }
}

function stockStatusClassName(status: StockStatus): string {
  switch (status) {
    case "In Stock":
      return "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30";
    case "Low Stock":
      return "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30";
    case "Out of Stock":
      return "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30";
    default:
      return "";
  }
}

export default function InventoryFoundationPanel() {
  const [view, setView] = useState<InventoryLocationType>("warehouse");
  const [items, setItems] = useState<InventoryItem[]>(sampleInventoryItems);
  const [search, setSearch] = useState("");
  const [modelFilter, setModelFilter] = useState<CompatibleModel | "All">(
    "All",
  );
  const [statusFilter, setStatusFilter] = useState<StockStatus | "All">("All");
  const [draftTransfers, setDraftTransfers] = useState<InventoryTransfer[]>([]);
  const [partsOrderDraft, setPartsOrderDraft] = useState<PartsOrderDraftLine[]>(
    [],
  );
  const [emergencyRequests, setEmergencyRequests] = useState<
    EmergencyStockRequest[]
  >([]);
  const [notice, setNotice] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState("");

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      if (item.locationType !== view) return false;
      const matchesSearch =
        !query ||
        item.partNumber.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query);
      const matchesModel =
        modelFilter === "All" ||
        item.compatibleModels.includes(modelFilter);
      const matchesStatus =
        statusFilter === "All" || item.stockStatus === statusFilter;
      return matchesSearch && matchesModel && matchesStatus;
    });
  }, [items, view, search, modelFilter, statusFilter]);

  const viewStats = useMemo(() => {
    const scoped = items.filter((item) => item.locationType === view);
    return {
      total: scoped.length,
      inStock: scoped.filter((i) => i.stockStatus === "In Stock").length,
      lowStock: scoped.filter((i) => i.stockStatus === "Low Stock").length,
      outOfStock: scoped.filter((i) => i.stockStatus === "Out of Stock").length,
    };
  }, [items, view]);

  function showNotice(message: string) {
    setNotice(message);
  }

  function handleAddItem() {
    showNotice(
      "Add Item is a placeholder. New inventory records will connect to warehouse/truck databases in a future release.",
    );
  }

  function startEditQuantity(item: InventoryItem) {
    setEditingId(item.id);
    setEditQty(String(item.quantityOnHand));
  }

  function saveEditQuantity(item: InventoryItem) {
    const nextQty = Math.max(0, Number.parseInt(editQty, 10) || 0);
    setItems((current) =>
      current.map((row) =>
        row.id === item.id
          ? {
              ...row,
              quantityOnHand: nextQty,
              stockStatus: deriveStockStatus(nextQty, row.minimumQuantity),
              lastUpdated: new Date().toISOString().slice(0, 10),
            }
          : row,
      ),
    );
    setEditingId(null);
    setEditQty("");
    showNotice(
      `Updated ${item.partNumber} quantity to ${nextQty}. Status recalculated automatically.`,
    );
  }

  function transferToTruck(item: InventoryItem) {
    if (item.locationType === "truck") {
      showNotice("Item is already on truck stock.");
      return;
    }
    const transfer = createDraftTransfer({
      item,
      quantity: 1,
      toLocation: getDefaultTruckLocation(),
      notes: "Draft transfer to truck stock",
    });
    setDraftTransfers((current) => [transfer, ...current]);
    showNotice(
      `Draft transfer created: ${item.partNumber} → Truck (${transfer.toLocationId}).`,
    );
  }

  function transferToWarehouse(item: InventoryItem) {
    if (item.locationType === "warehouse") {
      showNotice("Item is already in warehouse stock.");
      return;
    }
    const transfer = createDraftTransfer({
      item,
      quantity: 1,
      toLocation: getDefaultWarehouseLocation(),
      notes: "Draft transfer to warehouse stock",
    });
    setDraftTransfers((current) => [transfer, ...current]);
    showNotice(
      `Draft transfer created: ${item.partNumber} → Warehouse (${transfer.toLocationId}).`,
    );
  }

  function addToPartsOrder(item: InventoryItem) {
    const line = createPartsOrderDraftLine(item);
    setPartsOrderDraft((current) => [line, ...current]);
    showNotice(
      `Added ${item.partNumber} to parts order draft (qty ${line.quantity}, reason: ${line.reason}).`,
    );
  }

  function markEmergency(item: InventoryItem) {
    const request: EmergencyStockRequest = {
      id: `emg-${item.id}-${Date.now()}`,
      itemId: item.id,
      partNumber: item.partNumber,
      description: item.description,
      quantityNeeded: Math.max(item.minimumQuantity, 1),
      locationId: item.locationId,
      locationType: item.locationType,
      compatibleModels: item.compatibleModels,
      reason: "Emergency field need — placeholder request",
      status: "flagged",
      createdAt: new Date().toISOString().slice(0, 10),
    };
    setEmergencyRequests((current) => [request, ...current]);
    const line = createPartsOrderDraftLine(item, request.quantityNeeded, "emergency");
    setPartsOrderDraft((current) => [line, ...current]);
    showNotice(
      `Marked ${item.partNumber} as emergency need and added to parts order draft.`,
    );
  }

  return (
    <div className="space-y-6">
      {notice && (
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 px-4 py-3 text-sm text-cyan-200 sm:px-6 sm:py-4">
          {notice}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <MatrixButton
          type="button"
          variant={view === "warehouse" ? "primary" : "secondary"}
          size="md"
          onClick={() => setView("warehouse")}
          className="w-full sm:w-auto"
        >
          Warehouse Stock
        </MatrixButton>
        <MatrixButton
          type="button"
          variant={view === "truck" ? "primary" : "secondary"}
          size="md"
          onClick={() => setView("truck")}
          className="w-full sm:w-auto"
        >
          Truck Stock
        </MatrixButton>
        <MatrixButton
          type="button"
          variant="secondary"
          size="md"
          onClick={handleAddItem}
          className="w-full sm:w-auto"
        >
          Add Item
        </MatrixButton>
        <MatrixButton
          href="/scanner"
          variant="secondary"
          size="md"
          className="w-full sm:w-auto"
        >
          Scan Barcode / QR
        </MatrixButton>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MatrixStatCard label="Items in View" value={viewStats.total} />
        <MatrixStatCard
          label="In Stock"
          value={viewStats.inStock}
          accent="text-emerald-400"
        />
        <MatrixStatCard
          label="Low Stock"
          value={viewStats.lowStock}
          accent="text-amber-400"
        />
        <MatrixStatCard
          label="Out of Stock"
          value={viewStats.outOfStock}
          accent="text-rose-400"
        />
      </div>

      <MatrixCard
        title={view === "warehouse" ? "Warehouse Stock" : "Truck Stock"}
        subtitle="Search by part number or description. Filter by model and stock status."
      >
        <EnterpriseTableToolbar
          searchPlaceholder="Search parts"
          searchValue={search}
          onSearchChange={setSearch}
          resultCount={filteredItems.length}
          resultLabel="parts"
          activeFilterLabels={[
            search.trim() ? `Search: ${search.trim()}` : null,
            modelFilter !== "All" ? `Model: ${modelFilter}` : null,
            statusFilter !== "All" ? `Stock: ${statusFilter}` : null,
          ].filter(Boolean) as string[]}
          onClearFilters={() => {
            setSearch("");
            setModelFilter("All");
            setStatusFilter("All");
          }}
          onExport={() =>
            exportRowsAsCsv("parts-inventory-filtered", filteredItems, [
              {
                key: "partNumber",
                header: "Part Number",
                value: (r) => r.partNumber,
              },
              {
                key: "description",
                header: "Description",
                value: (r) => r.description,
              },
              {
                key: "quantityOnHand",
                header: "Qty",
                value: (r) => r.quantityOnHand,
              },
              {
                key: "minimumQuantity",
                header: "Min Qty",
                value: (r) => r.minimumQuantity,
              },
              {
                key: "stockStatus",
                header: "Status",
                value: (r) => r.stockStatus,
              },
              {
                key: "locationId",
                header: "Location",
                value: (r) => r.locationId,
              },
              {
                key: "compatibleModels",
                header: "Models",
                value: (r) => r.compatibleModels.join("; "),
              },
            ])
          }
          exportLabel="Export CSV (filtered results)"
          selectFilters={[
            {
              id: "model",
              label: "Model compatibility",
              value: modelFilter === "All" ? "" : modelFilter,
              allLabel: "All models",
              onChange: (value) =>
                setModelFilter((value || "All") as CompatibleModel | "All"),
              options: compatibleModels.map((model) => ({
                value: model,
                label: model,
              })),
            },
            {
              id: "stock",
              label: "Stock state",
              value: statusFilter === "All" ? "" : statusFilter,
              allLabel: "All stock states",
              onChange: (value) =>
                setStatusFilter((value || "All") as StockStatus | "All"),
              options: [
                { value: "In Stock", label: "In Stock" },
                { value: "Low Stock", label: "Low Stock" },
                { value: "Out of Stock", label: "Out of Stock" },
              ],
            },
          ]}
        />

        {filteredItems.length === 0 ? (
          <MatrixEmptyState
            title={
              search || modelFilter !== "All" || statusFilter !== "All"
                ? "No parts match these filters"
                : "No inventory items found"
            }
            description={
              search || modelFilter !== "All" || statusFilter !== "All"
                ? "Clear filters to view more results."
                : "Try a different search, model, or stock status filter."
            }
          />
        ) : (
          <div className="space-y-4">
            {filteredItems.map((item) => (
              <article
                key={item.id}
                className={`rounded-xl border p-4 sm:p-5 ${
                  item.stockStatus === "Out of Stock"
                    ? "border-rose-500/40 bg-rose-500/5"
                    : item.stockStatus === "Low Stock"
                      ? "border-amber-500/40 bg-amber-500/5"
                      : "border-slate-800 bg-slate-950/60"
                }`}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="font-mono text-sm font-semibold text-cyan-400 sm:text-base">
                        {item.partNumber}
                      </p>
                      <MatrixStatusBadge
                        variant={stockStatusVariant(item.stockStatus)}
                        label={item.stockStatus}
                        className={stockStatusClassName(item.stockStatus)}
                      />
                    </div>
                    <h4 className="text-base font-semibold text-white sm:text-lg">
                      {item.description}
                    </h4>
                    <dl className="grid gap-2 text-sm text-slate-400 sm:grid-cols-2">
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-slate-500">
                          Qty on hand
                        </dt>
                        <dd className="mt-0.5 text-lg font-bold text-white">
                          {editingId === item.id ? (
                            <input
                              type="number"
                              min={0}
                              value={editQty}
                              onChange={(e) => setEditQty(e.target.value)}
                              className="w-24 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-white"
                            />
                          ) : (
                            item.quantityOnHand
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-slate-500">
                          Minimum qty
                        </dt>
                        <dd className="mt-0.5 font-medium text-slate-200">
                          {item.minimumQuantity}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-slate-500">
                          Location
                        </dt>
                        <dd className="mt-0.5 font-medium text-slate-200">
                          {item.locationLabel}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-slate-500">
                          Compatible models
                        </dt>
                        <dd className="mt-0.5 font-medium text-slate-200">
                          {item.compatibleModels.join(", ")}
                        </dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="text-xs uppercase tracking-wide text-slate-500">
                          Last updated
                        </dt>
                        <dd className="mt-0.5 font-medium text-slate-200">
                          {item.lastUpdated}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div className="flex flex-wrap gap-2 lg:max-w-xs lg:justify-end">
                    {editingId === item.id ? (
                      <>
                        <MatrixButton
                          type="button"
                          variant="success"
                          size="sm"
                          onClick={() => saveEditQuantity(item)}
                        >
                          Save Qty
                        </MatrixButton>
                        <MatrixButton
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setEditingId(null);
                            setEditQty("");
                          }}
                        >
                          Cancel
                        </MatrixButton>
                      </>
                    ) : (
                      <MatrixButton
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => startEditQuantity(item)}
                      >
                        Edit Quantity
                      </MatrixButton>
                    )}
                    {item.locationType === "warehouse" ? (
                      <MatrixButton
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={() => transferToTruck(item)}
                      >
                        Transfer to Truck
                      </MatrixButton>
                    ) : (
                      <MatrixButton
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={() => transferToWarehouse(item)}
                      >
                        Transfer to Warehouse
                      </MatrixButton>
                    )}
                    <MatrixButton
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => addToPartsOrder(item)}
                    >
                      Add to Parts Order
                    </MatrixButton>
                    <MatrixButton
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={() => markEmergency(item)}
                    >
                      Mark as Emergency Need
                    </MatrixButton>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </MatrixCard>

      <div className="grid gap-6 lg:grid-cols-3">
        <MatrixCard
          title="Draft Transfers"
          subtitle={`${draftTransfers.length} draft transfer(s)`}
        >
          {draftTransfers.length === 0 ? (
            <p className="text-sm text-slate-500">
              No draft transfers yet. Use Transfer to Truck / Warehouse.
            </p>
          ) : (
            <ul className="space-y-3 text-sm">
              {draftTransfers.slice(0, 5).map((xfer) => (
                <li
                  key={xfer.id}
                  className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2"
                >
                  <p className="font-mono text-cyan-400">{xfer.partNumber}</p>
                  <p className="mt-1 text-slate-300">
                    Qty {xfer.quantity} · {xfer.fromLocationType} →{" "}
                    {xfer.toLocationType}
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-wide text-amber-300">
                    {xfer.status}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </MatrixCard>

        <MatrixCard
          title="Parts Order Draft"
          subtitle={`${partsOrderDraft.length} line(s) ready`}
        >
          {partsOrderDraft.length === 0 ? (
            <p className="text-sm text-slate-500">
              Low-stock and emergency items can be added here for ordering.
            </p>
          ) : (
            <ul className="space-y-3 text-sm">
              {partsOrderDraft.slice(0, 5).map((line) => (
                <li
                  key={line.id}
                  className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2"
                >
                  <p className="font-mono text-cyan-400">{line.partNumber}</p>
                  <p className="mt-1 text-slate-300">
                    Qty {line.quantity} · {line.reason}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </MatrixCard>

        <MatrixCard
          title="Emergency Needs"
          subtitle={`${emergencyRequests.length} flagged`}
        >
          {emergencyRequests.length === 0 ? (
            <p className="text-sm text-slate-500">
              No emergency stock requests flagged.
            </p>
          ) : (
            <ul className="space-y-3 text-sm">
              {emergencyRequests.slice(0, 5).map((req) => (
                <li
                  key={req.id}
                  className="rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2"
                >
                  <p className="font-mono text-rose-300">{req.partNumber}</p>
                  <p className="mt-1 text-slate-300">
                    Need {req.quantityNeeded} · {req.locationType}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </MatrixCard>
      </div>

      <MatrixCard
        title="Future Integration Points"
        subtitle="Placeholder hooks for upcoming Matrix inventory patches."
      >
        <ul className="grid gap-2 text-sm text-slate-400 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(INVENTORY_INTEGRATION_PLACEHOLDERS).map(
            ([key, value]) => (
              <li
                key={key}
                className="rounded-lg border border-dashed border-slate-700 bg-slate-950/40 px-3 py-2"
              >
                <span className="font-medium text-slate-300">{key}</span>
                <span className="ml-2 text-xs uppercase tracking-wide text-slate-600">
                  {value}
                </span>
              </li>
            ),
          )}
        </ul>
      </MatrixCard>
    </div>
  );
}
