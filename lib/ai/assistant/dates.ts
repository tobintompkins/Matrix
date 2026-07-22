/**
 * Patch 51A.1 Part 3 — Relative date parsing for NL assistant.
 */

export type ResolvedDateRange = {
  from: string;
  to: string;
  label: string;
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function resolveRelativeDateRange(
  question: string,
  now = new Date(),
): ResolvedDateRange | null {
  const q = question.toLowerCase();
  const today = startOfDay(now);

  if (/\btoday\b/.test(q)) {
    return {
      from: startOfDay(now).toISOString(),
      to: endOfDay(now).toISOString(),
      label: "today",
    };
  }
  if (/\byesterday\b/.test(q)) {
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    return {
      from: startOfDay(y).toISOString(),
      to: endOfDay(y).toISOString(),
      label: "yesterday",
    };
  }
  if (/\blast\s+7\s+days\b|\bpast\s+week\b|\blast\s+week\b/.test(q)) {
    const from = new Date(today);
    from.setDate(from.getDate() - 7);
    return {
      from: from.toISOString(),
      to: endOfDay(now).toISOString(),
      label: "last 7 days",
    };
  }
  if (/\blast\s+30\s+days\b|\bthis\s+month\b|\blast\s+month\b/.test(q)) {
    const from = new Date(today);
    if (/\bthis\s+month\b/.test(q)) {
      from.setDate(1);
    } else if (/\blast\s+month\b/.test(q)) {
      from.setMonth(from.getMonth() - 1, 1);
      const to = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);
      return {
        from: startOfDay(from).toISOString(),
        to: to.toISOString(),
        label: "last month",
      };
    } else {
      from.setDate(from.getDate() - 30);
    }
    return {
      from: from.toISOString(),
      to: endOfDay(now).toISOString(),
      label: /\bthis\s+month\b/.test(q) ? "this month" : "last 30 days",
    };
  }
  if (/\blast\s+90\s+days\b/.test(q)) {
    const from = new Date(today);
    from.setDate(from.getDate() - 90);
    return {
      from: from.toISOString(),
      to: endOfDay(now).toISOString(),
      label: "last 90 days",
    };
  }
  if (/\bthis\s+year\b/.test(q)) {
    const from = new Date(today.getFullYear(), 0, 1);
    return {
      from: from.toISOString(),
      to: endOfDay(now).toISOString(),
      label: "this year",
    };
  }
  if (/\bthis\s+week\b/.test(q)) {
    const from = new Date(today);
    const day = from.getDay();
    from.setDate(from.getDate() - ((day + 6) % 7));
    return {
      from: startOfDay(from).toISOString(),
      to: endOfDay(now).toISOString(),
      label: "this week",
    };
  }
  return null;
}
