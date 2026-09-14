"use client";
import { useFieldIdentity } from "@/app/field/FieldIdentityProvider";

import { useParams } from "next/navigation";
import { useState } from "react";
import FieldShell from "../../../FieldShell";
import {
  compressImageDataUrl,
  enqueueOperation,
  savePendingAttachment,
  type AttachmentCategory,
} from "@/lib/field";


const CATEGORIES: AttachmentCategory[] = [
  "BEFORE_REPAIR",
  "AFTER_REPAIR",
  "DAMAGED_PART",
  "PRINTER_COUNTER",
  "SERIAL_NUMBER",
  "ERROR_SCREEN",
  "INSTALLATION",
  "CUSTOMER_DOCUMENT",
  "OTHER",
];

export default function FieldAttachmentsPage() {
  const { technicianName: TECH, userId: TECH_ID } = useFieldIdentity();
  const params = useParams();
  const workOrderId = String(params.workOrderId ?? "");
  const [category, setCategory] = useState<AttachmentCategory>("BEFORE_REPAIR");
  const [caption, setCaption] = useState("");
  const [notice, setNotice] = useState("");
  const [sizeHint, setSizeHint] = useState("");

  async function handleFiles(files: FileList | null) {
    if (!files?.length || !workOrderId) return;
    for (const file of Array.from(files)) {
      const reader = new FileReader();
      await new Promise<void>((resolve) => {
        reader.onload = () => {
          void (async () => {
            const raw = String(reader.result ?? "");
            const compressed = await compressImageDataUrl(raw);
            setSizeHint(`Upload size ≈ ${Math.round(compressed.sizeBytes / 1024)} KB`);
            const op = await enqueueOperation({
              type: "PHOTO",
              userId: TECH_ID,
              technicianName: TECH,
              workOrderId,
              payload: {
                category,
                fileName: file.name,
                mimeType: "image/jpeg",
                sizeBytes: compressed.sizeBytes,
                caption,
                dataRef: compressed.dataUrl.slice(0, 160),
              },
            });
            await savePendingAttachment({
              operationId: op.operationId,
              workOrderId,
              category,
              fileName: file.name,
              mimeType: "image/jpeg",
              sizeBytes: compressed.sizeBytes,
              caption,
              dataRef: compressed.dataUrl,
            });
            setNotice(
              `Queued ${file.name}. Local copy kept until server confirms upload.`,
            );
            resolve();
          })();
        };
        reader.readAsDataURL(file);
      });
    }
  }

  return (
    <FieldShell title="Photos">
      <label className="block text-xs text-slate-400" htmlFor="cat">
        Category
      </label>
      <select
        id="cat"
        value={category}
        onChange={(e) => setCategory(e.target.value as AttachmentCategory)}
        className="mt-1 min-h-12 w-full rounded-xl border border-slate-700 bg-slate-900 px-4"
      >
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c.replaceAll("_", " ")}
          </option>
        ))}
      </select>

      <label className="mt-4 block text-xs text-slate-400" htmlFor="cap">
        Caption
      </label>
      <input
        id="cap"
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        className="mt-1 min-h-12 w-full rounded-xl border border-slate-700 bg-slate-900 px-4"
      />

      <label className="mt-4 block text-xs text-slate-400">
        Camera / gallery
        <input
          type="file"
          accept="image/*,application/pdf"
          capture="environment"
          multiple
          className="mt-2 block w-full text-sm"
          onChange={(e) => void handleFiles(e.target.files)}
        />
      </label>

      {sizeHint && <p className="mt-2 text-xs text-slate-500">{sizeHint}</p>}
      {notice && (
        <p className="mt-4 rounded-xl border border-cyan-800/50 bg-cyan-950/40 px-4 py-3 text-sm text-cyan-100">
          {notice}
        </p>
      )}
    </FieldShell>
  );
}
