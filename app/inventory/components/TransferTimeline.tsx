"use client";

import type { InventoryTransferOrder, TransferStatus } from "@/lib/warehouse";
import { TRANSFER_STATUS_FLOW } from "@/lib/warehouse";

const ORDER: TransferStatus[] = [
  "Requested",
  "Approved",
  "Picking",
  "Packed",
  "In Transit",
  "Delivered",
  "Received",
];

export default function TransferTimeline({
  transfer,
}: {
  transfer: InventoryTransferOrder;
}) {
  const cancelled = transfer.status === "Cancelled";
  const currentIdx = ORDER.indexOf(
    transfer.status === "Cancelled" ? "Requested" : transfer.status,
  );

  return (
    <ol className="flex flex-wrap gap-2" aria-label="Transfer status timeline">
      {ORDER.map((step, i) => {
        const done = !cancelled && i <= currentIdx;
        const current = !cancelled && step === transfer.status;
        return (
          <li
            key={step}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              cancelled
                ? "bg-slate-800 text-slate-500"
                : current
                  ? "bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/40"
                  : done
                    ? "bg-emerald-500/15 text-emerald-300"
                    : "bg-slate-800 text-slate-500"
            }`}
          >
            {step}
          </li>
        );
      })}
      {cancelled ? (
        <li className="rounded-full bg-rose-500/15 px-3 py-1 text-xs font-medium text-rose-300">
          Cancelled
        </li>
      ) : null}
      {!cancelled && TRANSFER_STATUS_FLOW[transfer.status].length === 0 ? null : null}
    </ol>
  );
}
