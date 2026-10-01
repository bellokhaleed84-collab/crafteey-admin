"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { naira } from "@/lib/format";

type Report = {
  range: { from: string; to: string };
  totals: {
    orders: number;
    totalKobo: number;
    subtotalKobo: number;
    deliveryFeeKobo: number;
    vendorPayoutKobo: number;
    platformVendorRevenueKobo: number;
    riderEarningKobo: number;
    platformCommissionKobo: number;
    platformRevenueKobo: number;
  };
  cancelled: { orders: number; totalKobo: number; refundedKobo: number };
  byTier: { tier: string; orders: number; subtotalKobo: number; platformVendorRevenueKobo: number }[];
  byDay: { day: string; orders: number; totalKobo: number }[];
  topVendors: { vendorId: string; name: string; orders: number; subtotalKobo: number; platformVendorRevenueKobo: number }[];
  payouts: { status: string; n: number; kobo: number }[];
  riderLedger: { type: string; n: number; kobo: number }[];
};

const LEDGER_LABELS: Record<string, string> = {
  hub_earning: "Hub earnings credited",
  direct_ride_debt: "Direct ride debt added",
  withdrawal: "Withdrawals",
  debt_payment: "Debt payments",
};

// Lagos calendar day helpers (UTC+1, no daylight saving).
function todayLagos() {
  return new Date(Date.now() + 3600000).toISOString().slice(0, 10);
}
function shift(dateStr: string, days: number) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + days * 86400000).toISOString().slice(0, 10);
}

export default function ReportsPage() {
  const { getIdToken } = useAdminAuth();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [applied, setApplied] = useState<{ from: string; to: string }>({ from: "", to: "" });
  const [data, setData] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const token = await getIdToken();
      const qs = applied.from && applied.to ? `?from=${applied.from}&to=${applied.to}` : "";
      const res = await fetch(`/api/admin/reports${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error || "Something went wrong");
      setData(d);
      setFrom(d.range.from);
      setTo(d.range.to);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the report");
    } finally {
      setLoading(false);
    }
  }, [getIdToken, applied]);

  useEffect(() => {
    void load();
  }, [load]);

  const preset = (days: number) => {
    const end = todayLagos();
    setApplied({ from: shift(end, -(days - 1)), to: end });
  };
  const thisMonth = () => {
    const end = todayLagos();
    setApplied({ from: `${end.slice(0, 8)}01`, to: end });
  };

  async function download(type: "orders" | "payouts" | "transactions") {
    if (!data) return;
    setExporting(type);
    setError("");
    try {
      const token = await getIdToken();
      const res = await fetch(`/api/admin/reports/export?type=${type}&from=${data.range.from}&to=${data.range.to}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error || "Export failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `crafteey-${type}-${data.range.from}-to-${data.range.to}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      if (res.headers.get("X-Truncated") === "1") {
        setError("The export stopped at 10,000 rows. Pick a shorter date range to get everything.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting("");
    }
  }

  const maxDay = Math.max(1, ...(data?.byDay.map((d) => d.totalKobo) ?? [1]));
  const t = data?.totals;

  const cards = t
    ? [
        { label: "Order value", value: naira(t.totalKobo), sub: `${t.orders} paid orders (not cancelled)` },
        { label: "Platform revenue", value: naira(t.platformRevenueKobo), sub: "Vendor commission + delivery share" },
        { label: "Vendor commission", value: naira(t.platformVendorRevenueKobo), sub: `On ${naira(t.subtotalKobo)} of items` },
        { label: "Delivery fees", value: naira(t.deliveryFeeKobo), sub: `Riders ${naira(t.riderEarningKobo)} · platform ${naira(t.platformCommissionKobo)}` },
        { label: "Owed to vendors", value: naira(t.vendorPayoutKobo), sub: "Item subtotal minus commission" },
        {
          label: "Cancelled",
          value: String(data!.cancelled.orders),
          sub: `${naira(data!.cancelled.totalKobo)} · refunded ${naira(data!.cancelled.refundedKobo)}`,
        },
      ]
    : [];

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Reports &amp; Exports</h1>
      <p className="mt-1 text-sm text-slate-500">Hub order money for a date range. Days are Lagos time.</p>

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <label className="text-xs font-semibold text-slate-500">
          From
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-1 block rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
          />
        </label>
        <label className="text-xs font-semibold text-slate-500">
          To
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="mt-1 block rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
          />
        </label>
        <button
          type="button"
          disabled={!from || !to}
          onClick={() => setApplied({ from, to })}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          Apply
        </button>
        <button type="button" onClick={() => preset(7)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600">
          Last 7 days
        </button>
        <button type="button" onClick={() => preset(30)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600">
          Last 30 days
        </button>
        <button type="button" onClick={thisMonth} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600">
          This month
        </button>
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {loading && <p className="mt-4 text-sm text-slate-500">Loading…</p>}

      {data && !loading && (
        <div className="mt-4 space-y-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {cards.map((c) => (
              <div key={c.label} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase text-slate-400">{c.label}</p>
                <p className="mt-1 text-lg font-bold text-slate-900">{c.value}</p>
                <p className="text-xs text-slate-500">{c.sub}</p>
              </div>
            ))}
          </div>

          <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <p className="text-sm font-bold text-slate-900">Order value per day</p>
            {data.byDay.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No paid orders in this range.</p>
            ) : (
              <div className="mt-3 flex h-32 items-end gap-1">
                {data.byDay.map((d) => (
                  <div
                    key={d.day}
                    title={`${d.day}: ${naira(d.totalKobo)} · ${d.orders} orders`}
                    className="min-w-[3px] flex-1 rounded-t bg-amber-400"
                    style={{ height: `${Math.max(3, (d.totalKobo / maxDay) * 100)}%` }}
                  />
                ))}
              </div>
            )}
            {data.byDay.length > 0 && (
              <div className="mt-1 flex justify-between text-[11px] text-slate-400">
                <span>{data.byDay[0].day}</span>
                <span>{data.byDay[data.byDay.length - 1].day}</span>
              </div>
            )}
          </section>

          <div className="grid gap-5 md:grid-cols-2">
            <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <p className="text-sm font-bold text-slate-900">Commission by vendor tier</p>
              {data.byTier.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">Nothing yet.</p>
              ) : (
                <ul className="mt-2 divide-y divide-slate-100">
                  {data.byTier.map((x) => (
                    <li key={x.tier} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <div>
                        <p className="font-semibold capitalize text-slate-900">{x.tier}</p>
                        <p className="text-xs text-slate-500">
                          {x.orders} orders · {naira(x.subtotalKobo)} items
                        </p>
                      </div>
                      <span className="font-bold text-slate-900">{naira(x.platformVendorRevenueKobo)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <p className="text-sm font-bold text-slate-900">Top vendors by item sales</p>
              {data.topVendors.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">Nothing yet.</p>
              ) : (
                <ul className="mt-2 divide-y divide-slate-100">
                  {data.topVendors.map((v) => (
                    <li key={v.vendorId} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900">{v.name}</p>
                        <p className="text-xs text-slate-500">
                          {v.orders} orders · commission {naira(v.platformVendorRevenueKobo)}
                        </p>
                      </div>
                      <span className="shrink-0 font-bold text-slate-900">{naira(v.subtotalKobo)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <p className="text-sm font-bold text-slate-900">Rider payouts requested</p>
              {data.payouts.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">None in this range.</p>
              ) : (
                <ul className="mt-2 divide-y divide-slate-100">
                  {data.payouts.map((p) => (
                    <li key={p.status} className="flex items-center justify-between py-2 text-sm">
                      <span className="font-semibold capitalize text-slate-900">
                        {p.status} <span className="font-normal text-slate-500">({p.n})</span>
                      </span>
                      <span className="font-bold text-slate-900">{naira(p.kobo)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <p className="text-sm font-bold text-slate-900">Rider ledger activity</p>
              {data.riderLedger.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">None in this range.</p>
              ) : (
                <ul className="mt-2 divide-y divide-slate-100">
                  {data.riderLedger.map((l) => (
                    <li key={l.type} className="flex items-center justify-between py-2 text-sm">
                      <span className="font-semibold text-slate-900">
                        {LEDGER_LABELS[l.type] || l.type} <span className="font-normal text-slate-500">({l.n})</span>
                      </span>
                      <span className="font-bold text-slate-900">{naira(l.kobo)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <p className="text-sm font-bold text-slate-900">Download CSV</p>
            <p className="mt-1 text-xs text-slate-500">
              Uses the dates above. Each download is recorded in the audit log. Up to 10,000 rows each.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(
                [
                  ["orders", "Orders"],
                  ["payouts", "Rider payouts"],
                  ["transactions", "Rider ledger"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  disabled={!!exporting}
                  onClick={() => void download(key)}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40"
                >
                  {exporting === key ? "Preparing…" : label}
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}