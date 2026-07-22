/**
 * Patch 51B — Customer-visible service attachment uploads.
 * Files live under data/portal-uploads; metadata is customer-scoped and
 * never exposes internal-only attachments.
 */

import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db/prisma";
import { getPortalSettings } from "./config";
import { safeFileName, validatePortalUpload, checkRateLimit } from "./security";
import { getPortalTicket, addPortalMessage } from "./repository";
import type { CustomerMembership } from "./types";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";

const UPLOAD_ROOT = path.join(process.cwd(), "data", "portal-uploads");
const MANIFEST_PATH = path.join(UPLOAD_ROOT, "manifest.json");

type ManifestEntry = {
  id: string;
  customerId: string;
  membershipId: string;
  ticketId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  relativePath: string;
  caption: string | null;
  uploadedAt: string;
  visibleToCustomer: true;
};

async function readManifest(): Promise<ManifestEntry[]> {
  try {
    const raw = await readFile(MANIFEST_PATH, "utf8");
    const parsed = JSON.parse(raw) as ManifestEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeManifest(entries: ManifestEntry[]) {
  await mkdir(UPLOAD_ROOT, { recursive: true });
  await writeFile(MANIFEST_PATH, JSON.stringify(entries, null, 2), "utf8");
}

export async function uploadPortalServiceAttachment(input: {
  membership: CustomerMembership;
  organizationId?: string;
  ticketId: string;
  fileName: string;
  mimeType: string;
  bytes: Buffer;
  caption?: string;
}) {
  const settings = await getPortalSettings(
    input.organizationId ?? DEFAULT_ORG_ID,
  );
  const rate = checkRateLimit(`att:${input.membership.id}`, 20, 60_000);
  if (!rate.ok) return { ok: false as const, error: rate.error };

  const detail = getPortalTicket(input.ticketId);
  if (!detail.ok) return { ok: false as const, error: "Record not available." };

  if (input.membership.role === "CUSTOMER_VIEWER") {
    return {
      ok: false as const,
      error: "Read-only users cannot upload attachments.",
    };
  }

  const mime = input.mimeType.toLowerCase();
  const allowed = new Set(
    settings.allowedAttachmentTypes.map((t) => t.toLowerCase()),
  );
  if (!allowed.has(mime)) {
    const fallback = validatePortalUpload(
      mime,
      input.bytes.length,
      settings.maxAttachmentBytes,
    );
    if (!fallback.ok) return { ok: false as const, error: fallback.error };
  } else if (
    input.bytes.length <= 0 ||
    input.bytes.length > settings.maxAttachmentBytes
  ) {
    return { ok: false as const, error: "File size exceeds the allowed limit." };
  }

  const id = `patt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const fileName = safeFileName(input.fileName);
  const dir = path.join(UPLOAD_ROOT, input.membership.customerId);
  await mkdir(dir, { recursive: true });
  const storagePath = path.join(dir, `${id}_${fileName}`);
  await writeFile(storagePath, input.bytes);

  const relativePath = path
    .relative(UPLOAD_ROOT, storagePath)
    .split(path.sep)
    .join("/");

  const entry: ManifestEntry = {
    id,
    customerId: input.membership.customerId,
    membershipId: input.membership.id,
    ticketId: input.ticketId,
    fileName,
    mimeType: mime,
    sizeBytes: input.bytes.length,
    relativePath,
    caption: (input.caption ?? "").slice(0, 500) || null,
    uploadedAt: new Date().toISOString(),
    visibleToCustomer: true,
  };

  const manifest = await readManifest();
  manifest.unshift(entry);
  await writeManifest(manifest);

  // Best-effort Prisma row when the ticket exists in ServiceTicket.
  try {
    await prisma.serviceTicketAttachment.create({
      data: {
        id,
        ticketId: input.ticketId,
        attachmentType: "CUSTOMER_PORTAL",
        fileName,
        fileUrl: `portal-upload:${relativePath}`,
        uploadedBy: input.membership.displayName,
        caption: entry.caption,
        visibleToCustomer: true,
      },
    });
  } catch {
    // Ticket may live in the in-memory dispatch store only.
  }

  addPortalMessage({
    ticketId: input.ticketId,
    body: entry.caption
      ? `Attached file: ${fileName}\n${entry.caption}`
      : `Attached file: ${fileName}`,
    attachmentName: fileName,
    mimeType: mime,
    sizeBytes: input.bytes.length,
  });

  return {
    ok: true as const,
    attachment: {
      id: entry.id,
      fileName: entry.fileName,
      mimeType: entry.mimeType,
      sizeBytes: entry.sizeBytes,
      uploadedAt: entry.uploadedAt,
      visibleToCustomer: true as const,
    },
  };
}

export async function authorizePortalAttachmentDownload(input: {
  membership: CustomerMembership;
  attachmentId: string;
}): Promise<
  | { ok: true; entry: ManifestEntry; bytes: Buffer }
  | { ok: false; error: string }
> {
  const manifest = await readManifest();
  const entry = manifest.find((e) => e.id === input.attachmentId);
  if (!entry || entry.customerId !== input.membership.customerId) {
    return { ok: false, error: "Record not available." };
  }
  if (!entry.visibleToCustomer) {
    return { ok: false, error: "Record not available." };
  }

  const detail = getPortalTicket(entry.ticketId);
  if (!detail.ok) return { ok: false, error: "Record not available." };

  if (
    entry.relativePath.includes("..") ||
    path.isAbsolute(entry.relativePath)
  ) {
    return { ok: false, error: "Invalid storage reference." };
  }
  const full = path.join(UPLOAD_ROOT, entry.relativePath);
  if (!full.startsWith(UPLOAD_ROOT)) {
    return { ok: false, error: "Invalid storage reference." };
  }
  try {
    const bytes = await readFile(full);
    return { ok: true, entry, bytes };
  } catch {
    return { ok: false, error: "File not found." };
  }
}
