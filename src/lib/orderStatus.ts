// CHECK: copy the real HUB_ORDER_STATUSES from crafteey-client/src/lib/hub/config.ts.
// Only the FINISHED states need to be right. A "live" order is any paid order
// that is not in one of these lists, so new in-between statuses work on their own.
export const DELIVERED_STATUSES: string[] = ["delivered", "completed"];
export const CANCELLED_STATUSES: string[] = ["cancelled", "canceled", "refunded"];
export const UNPAID_STATUSES: string[] = ["pending_payment", "payment_failed", "failed"];

export const TERMINAL_STATUSES: string[] = [...DELIVERED_STATUSES, ...CANCELLED_STATUSES, ...UNPAID_STATUSES];

export function statusLabel(status?: string): string {
  return (status || "unknown").replace(/_/g, " ");
}

export function statusStyle(status?: string): string {
  const s = status || "";
  if (DELIVERED_STATUSES.includes(s)) return "bg-emerald-50 text-emerald-700";
  if (CANCELLED_STATUSES.includes(s)) return "bg-slate-100 text-slate-600";
  if (UNPAID_STATUSES.includes(s)) return "bg-amber-50 text-amber-700";
  return "bg-blue-50 text-blue-700";
}