/**
 * MX-SVC-YYYY-000001 ticket numbering with collision-safe sequence.
 */

const SEQ_KEY = "matrix.service-dispatch.ticket-seq.v1";

let memorySeq: { year: number; seq: number } | null = null;

function currentYear(from = new Date()): number {
  return from.getFullYear();
}

function readSeq(year: number): number {
  if (typeof window !== "undefined" && typeof sessionStorage !== "undefined") {
    try {
      const raw = sessionStorage.getItem(SEQ_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { year: number; seq: number };
        if (parsed.year === year) return parsed.seq;
        return 0;
      }
    } catch {
      /* fall through */
    }
  }
  if (memorySeq && memorySeq.year === year) return memorySeq.seq;
  return 0;
}

function writeSeq(year: number, seq: number): void {
  memorySeq = { year, seq };
  if (typeof window !== "undefined" && typeof sessionStorage !== "undefined") {
    try {
      sessionStorage.setItem(SEQ_KEY, JSON.stringify({ year, seq }));
    } catch {
      /* ignore */
    }
  }
}

/** Reserve next unique ticket number. Never reuses within the store. */
export function nextServiceTicketNumber(
  existingNumbers: string[] = [],
  from = new Date(),
): string {
  const year = currentYear(from);
  let seq = Math.max(readSeq(year), 0);
  const existing = new Set(existingNumbers.map((n) => n.toUpperCase()));

  // Also parse max from existing MX-SVC-YEAR-###### numbers
  for (const n of existingNumbers) {
    const m = /^MX-SVC-(\d{4})-(\d+)$/i.exec(n.trim());
    if (m && Number(m[1]) === year) {
      seq = Math.max(seq, Number(m[2]));
    }
  }

  let candidate = "";
  do {
    seq += 1;
    candidate = `MX-SVC-${year}-${String(seq).padStart(6, "0")}`;
  } while (existing.has(candidate.toUpperCase()));

  writeSeq(year, seq);
  return candidate;
}

export function resetTicketNumberingForTests(): void {
  memorySeq = null;
  if (typeof window !== "undefined" && typeof sessionStorage !== "undefined") {
    sessionStorage.removeItem(SEQ_KEY);
  }
}

export function isValidServiceTicketNumber(value: string): boolean {
  return /^MX-SVC-\d{4}-\d{6}$/i.test(value.trim());
}
