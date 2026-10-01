export function naira(kobo?: number | null): string {
  const n = Number(kobo ?? 0) / 100;
  return `₦${n.toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;
}

export function dateTime(value?: string | Date | null): string {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Africa/Lagos",
  }).format(new Date(value));
}