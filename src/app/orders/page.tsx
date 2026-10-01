"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { naira, dateTime } from "@/lib/format";
import { statusLabel, statusStyle } from "@/lib/orderStatus";

type Tab = "live" | "delivered" | "cancelled" | "all";

type Row = {
  _id: string;
  orderNumber: string;
  vendorName: string;
  status: string;
  totalKobo: number;
  vehicleType: string;
  paymentStatus: string;
  address: string;
  createdAt: string;
};

const TABS: { key: Tab; label: string }[] = [
  { key: "live", label: "Live" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
  { key: "all", label: "All" },
];

export default function OrdersPage() {
  const { getIdToken } = useAdminAuth();
  const [tab, setTab] = useState<Tab>("live");
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [applied, setApplied] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(
    async (silent = false) => {
      const token = await getIdToken();
      if (!token) return;
      if (!silent) setLoading(true);
      try {
        const qs = new URLSearchParams({ tab, page: String(page) });
        if (applied) qs.set("q", applied);
        const res = await fetch(`/api/admin/orders?${qs}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data?.error || "Couldn't load orders.");
          return;
        }
        setError("");
        setRows(Array.isArray(data.orders) ? data.orders : []);
        setCounts(data.counts ?? {});
        setTotal(Number(data.total) || 0);
        setPageSize(Number(data.pageSize) || 25);
      } catch {
        setError("Network error. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [getIdToken, tab, page, applied]
  );

  useEffect(() => {
    load();
  }, [load]);

  // The Live tab refreshes itself.
  useEffect(() => {
    if (tab !== "live") return;
    const t = setInterval(() => load(true), 30000);
    return () => clearInterval(t);
  }, [tab, load]);

  const lastPage = Math.max(Math.ceil(total / pageSize), 1);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900">Orders</h1>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setApplied(q.trim());
          }}
          className="flex gap-2"
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Order number or vendor"
            className="w-56 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
            Search
          </button>
        </form>
      </div>

      <div className="flex gap-1 overflow-x-auto whitespace-nowrap text-sm font-semibold [scrollbar-width:none]">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setTab(t.key);
              setPage(1);
            }}
            aria-pressed={tab === t.key}
            className={`rounded-lg px-3 py-2 ${
              tab === t.key ? "bg-slate-900 text-white" : "border border-slate-100 bg-white text-slate-500 hover:text-slate-900"
            }`}
          >
            {t.label}
            <span className={`ml-1.5 text-xs ${tab === t.key ? "text-slate-300" : "text-slate-400"}`}>
              {counts[t.key] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-400">{applied ? "No orders match that search." : "Nothing here yet."}</p>
      ) : (
        <div className="divide-y divide-slate-100 rounded-2xl border border-slate-100 bg-white shadow-sm">
          {rows.map((o) => (
            <Link key={o._id} href={`/orders/${o._id}`} className="flex items-start justify-between gap-3 p-4 hover:bg-slate-50">
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900">
                  {o.orderNumber} <span className="font-normal text-slate-500">· {o.vendorName}</span>
                </p>
                <p className="mt-0.5 truncate text-xs text-slate-500">{o.address || "No address"}</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {dateTime(o.createdAt)}
                  {o.vehicleType ? ` · ${o.vehicleType}` : ""}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <span className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${statusStyle(o.status)}`}>
                  {statusLabel(o.status)}
                </span>
                <p className="mt-1 text-sm font-bold text-slate-900">{naira(o.totalKobo)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {total > pageSize && (
        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-slate-500">
            Page {page} of {lastPage}
          </span>
          <button
            type="button"
            disabled={page >= lastPage}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}