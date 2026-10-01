const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 366;

// Midnight of a Lagos calendar day (UTC+1, no daylight saving), as a UTC Date.
function lagosMidnight(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) - HOUR);
}

function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + n * DAY).toISOString().slice(0, 10);
}

export type ReportRange =
  | { ok: true; from: Date; toExclusive: Date; fromStr: string; toStr: string }
  | { ok: false; error: string };

/** Reads ?from=YYYY-MM-DD&to=YYYY-MM-DD (Lagos days, both included). Default: last 30 days. */
export function parseRange(sp: URLSearchParams): ReportRange {
  const todayStr = new Date(Date.now() + HOUR).toISOString().slice(0, 10);
  const toStr = sp.get("to") || todayStr;
  const fromStr = sp.get("from") || addDays(toStr, -29);

  if (!DATE_RE.test(fromStr) || !DATE_RE.test(toStr) || isNaN(Date.parse(fromStr)) || isNaN(Date.parse(toStr))) {
    return { ok: false, error: "Dates must look like 2026-10-01." };
  }
  if (fromStr > toStr) return { ok: false, error: "The start date must be before the end date." };
  const days = (Date.parse(toStr) - Date.parse(fromStr)) / DAY + 1;
  if (days > MAX_DAYS) return { ok: false, error: `Pick a range of at most ${MAX_DAYS} days.` };

  return { ok: true, from: lagosMidnight(fromStr), toExclusive: lagosMidnight(addDays(toStr, 1)), fromStr, toStr };
}