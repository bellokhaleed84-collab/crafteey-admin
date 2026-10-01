"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { naira, dateTime } from "@/lib/format";

type Row = {
  _id: string;
  riderName: string;
  riderPhone: string;
  amountKobo: number;
  status: string;
  failureReason: string | null;
  paystackTransferRef: string | null;
  createdAt: string;
  updatedAt: string;
};
type Bucket = { n: number; kobo: number };
type Summary = Record<"pending" | "processing" | "paid" | "failed", Bucket>;

const TABS = ["all", "pending", "processing", "paid", "failed"] as const;

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700",
  processing: "bg-blue-50 text-blue-700",
  paid: "bg-emerald-50 text-emerald-700",
  failed: "bg-red-50 text-red-700",
};

export default function PayoutsPage() {
  const { getIdToken } = useAdminAuth();
  const [tab, setTab] = useState<(typeof TABS)[number]>("all");
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const token = await getIdToken();
      const res = await fetch(
        `/api/admin/payouts?status=${tab}&page=${page}&q=${encodeURIComponent(search)}`,
        { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
      );
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error || "Something went wrong");
      setRows(d.payouts);
      setSummary(d.summary);
      setPages(d.pages || 1);
      setTotal(d.total || 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load payouts");
    } finally {
      setLoading(false);
    }
  }, [getIdToken, tab, page, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const cards: { key: keyof Summary; label: string }[] = [
    { key: "pending", label: "Pending" },
    { key: "processing", label: "Processing" },
    { key: "failed", label: "Failed" },
    { key: "paid", label: "Paid" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Payouts</h1>
      <p className="mt-1 text-sm text-slate-500">Rider withdrawals. Read-only for now.</p>

      {summary && (
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          {cards.map((c) => (
            <div key={c.key} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase text-slate-400">{c.label}</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{naira(summary[c.key].kobo)}</p>
              <p className="text-xs text-slate-500">
                {summary[c.key].n} payout{summary[c.key].n === 1 ? "" : "s"}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setTab(t);
              setPage(1);
            }}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold capitalize ${
              tab === t ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setPage(1);
              setSearch(q);
            }
          }}
          placeholder="Search rider name, phone or transfer reference"
          className="w-full max-w-sm rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={() => {
            setPage(1);
            setSearch(q);
          }}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
        >
          Search
        </button>
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        {loading ? (
          <p className="p-6 text-sm text-slate-500">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No payouts found.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((p) => (
              <li key={p._id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-900">{p.riderName}</p>
                  <p className="truncate text-xs text-slate-500">
                    {p.riderPhone || "no phone"} · Requested {dateTime(p.createdAt)}
                  </p>
                  {p.paystackTransferRef && (
                    <p className="truncate text-[11px] text-slate-400">Ref: {p.paystackTransferRef}</p>
                  )}
                  {p.status === "failed" && p.failureReason && (
                    <p className="text-xs text-red-600">{p.failureReason}</p>
                  )}
                </div>
                <span className="text-sm font-bold text-slate-900">{naira(p.amountKobo)}</span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize ${
                    STATUS_STYLE[p.status] || "bg-slate-100 text-slate-600"
                  }`}
                >
                  {p.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-slate-500">
            Page {page} of {pages} · {total} total
          </span>
          <button
            type="button"
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}