"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";

type Row = {
  _id: string;
  name?: string;
  email?: string;
  phone?: string;
  createdAt: string;
  orders: number;
  spentKobo?: number;
};

type Detail = {
  customer: { _id: string; name?: string; email?: string; phone?: string; createdAt: string };
  stats: { orders: number; cancelled: number; spentKobo?: number };
  recent: { _id: string; orderNumber: string; vendorName: string; status: string; totalKobo: number; createdAt: string }[];
};

function naira(kobo: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 2 }).format(
    (kobo || 0) / 100
  );
}
function day(d: string) {
  return new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

export default function CustomersPage() {
  const { getIdToken } = useAdminAuth();
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const api = useCallback(
    async (path: string) => {
      const token = await getIdToken();
      const res = await fetch(path, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Something went wrong");
      return data;
    },
    [getIdToken]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const d = await api(`/api/admin/customers?page=${page}&q=${encodeURIComponent(search)}`);
      setRows(d.customers);
      setPages(d.pages || 1);
      setTotal(d.total || 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load customers");
    } finally {
      setLoading(false);
    }
  }, [api, page, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const showSpend = rows.some((r) => typeof r.spentKobo === "number");

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Customers</h1>
      <p className="mt-1 text-sm text-slate-500">{total} customers. Read-only.</p>

      <div className="mt-4 flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setPage(1);
              setSearch(q);
            }
          }}
          placeholder="Search name, email or phone"
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
          <p className="p-6 text-sm text-slate-500">No customers found.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((c) => (
              <li key={c._id}>
                <button
                  type="button"
                  onClick={() => setOpenId(c._id)}
                  className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left hover:bg-slate-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-900">{c.name || "No name"}</p>
                    <p className="truncate text-xs text-slate-500">
                      {c.email || "no email"} · {c.phone || "no phone"}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-slate-500">
                    {c.orders} order{c.orders === 1 ? "" : "s"}
                  </span>
                  {showSpend && (
                    <span className="text-xs font-semibold text-slate-700">{naira(c.spentKobo ?? 0)}</span>
                  )}
                  <span className="text-xs text-slate-400">Joined {day(c.createdAt)}</span>
                </button>
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
            Page {page} of {pages}
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

      {openId && <CustomerPanel id={openId} api={api} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function CustomerPanel({
  id,
  api,
  onClose,
}: {
  id: string;
  api: (path: string) => Promise<any>;
  onClose: () => void;
}) {
  const [d, setD] = useState<Detail | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api(`/api/admin/customers/${id}`)
      .then(setD)
      .catch((e) => setErr(e instanceof Error ? e.message : "Could not load customer"));
  }, [api, id]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative h-full w-full max-w-lg overflow-y-auto bg-white p-6 shadow-xl">
        <button type="button" onClick={onClose} className="absolute right-4 top-4 text-sm font-semibold text-slate-500">
          Close
        </button>
        {!d ? (
          <p className="text-sm text-slate-500">{err || "Loading…"}</p>
        ) : (
          <div className="space-y-5">
            <div>
              <h2 className="pr-12 text-xl font-bold text-slate-900">{d.customer.name || "No name"}</h2>
              <p className="text-xs text-slate-500">Joined {day(d.customer.createdAt)}</p>
            </div>

            <dl className="space-y-1 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Email</dt>
                <dd className="break-all text-right font-medium text-slate-900">{d.customer.email || "-"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Phone</dt>
                <dd className="text-right font-medium text-slate-900">{d.customer.phone || "-"}</dd>
              </div>
            </dl>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-lg font-bold text-slate-900">{d.stats.orders}</p>
                <p className="text-[11px] text-slate-500">Paid orders</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-lg font-bold text-slate-900">{d.stats.cancelled}</p>
                <p className="text-[11px] text-slate-500">Cancelled</p>
              </div>
              {typeof d.stats.spentKobo === "number" && (
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-sm font-bold text-slate-900">{naira(d.stats.spentKobo)}</p>
                  <p className="text-[11px] text-slate-500">Spent</p>
                </div>
              )}
            </div>

            <div>
              <p className="mb-2 text-xs font-bold uppercase text-slate-400">Recent orders</p>
              {d.recent.length === 0 ? (
                <p className="text-sm text-slate-500">No paid orders yet.</p>
              ) : (
                <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
                  {d.recent.map((o) => (
                    <li key={o._id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900">
                          #{o.orderNumber} · {o.vendorName}
                        </p>
                        <p className="text-xs capitalize text-slate-500">
                          {o.status.replace(/_/g, " ")} · {day(o.createdAt)}
                        </p>
                      </div>
                      <span className="shrink-0 font-semibold text-slate-700">{naira(o.totalKobo)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}