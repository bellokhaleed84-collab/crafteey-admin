// Mirrors HUB_ORDER_STATUSES in crafteey-client/src/lib/hub/config.ts.
// If the client app adds a status, add it here too.
export const HUB_ORDER_STATUS_LABELS: Record<string, string> = {
  pending_payment: "Awaiting payment",
  paid: "Paid",
  preparing: "Preparing",
  out_for_delivery: "On the way",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const DELIVERED_STATUSES: string[] = ["delivered"];
export const CANCELLED_STATUSES: string[] = ["cancelled"];
export const UNPAID_STATUSES: string[] = ["pending_payment"];

// A "live" order is paid and not in any of these.
export const TERMINAL_STATUSES: string[] = [...DELIVERED_STATUSES, ...CANCELLED_STATUSES, ...UNPAID_STATUSES];

// Labels the order statuses above, and also the rider's delivery statuses (accepted, picked_up...).
export function statusLabel(status?: string): string {
  const s = status || "";
  return HUB_ORDER_STATUS_LABELS[s] ?? (s ? s.replace(/_/g, " ") : "unknown");
}

export function statusStyle(status?: string): string {
  const s = status || "";
  if (DELIVERED_STATUSES.includes(s)) return "bg-emerald-50 text-emerald-700";
  if (CANCELLED_STATUSES.includes(s)) return "bg-slate-100 text-slate-600";
  if (UNPAID_STATUSES.includes(s)) return "bg-amber-50 text-amber-700";
  return "bg-blue-50 text-blue-700";
}