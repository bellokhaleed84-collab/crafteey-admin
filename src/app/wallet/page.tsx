"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { naira, dateTime } from "@/lib/format";

type Tx = {
  _id: string;
  riderName: string;
  type: string;
  amountKobo: number;
  walletBalanceAfterKobo: number;
  debtAfterKobo: number;
  label: string;
  status: string;
  createdAt: string;
};
type RiderRow = {
  _id: string;
  name: string;
  phone: string;
  status: string;
  debtKobo: number;
  walletBalanceKobo: number;
  lifetimeEarningsKobo: number;
  accountSuspended: boolean;
};
type Totals = { debtKobo: number; walletKobo: number; overAlert: number; debtSuspended: number };
type Thresholds = { alertKobo: number; blockKobo: number };

const TYPE_INFO: Record<string, { label: string; effect: string; style: string }> = {
  hub_earning: { label: "Hub earning", effect: "Wallet +", style: "bg-emerald-50 text-emerald-700" },
  direct_ride_debt: { label: "Direct ride debt", effect: "Debt +", style: "bg-red-50 text-red-700" },
  withdrawal: { label: "Withdrawal", effect: "Wallet −", style: "bg-blue-50 text-blue-700" },
  debt_payment: { label: "Debt payment", effect: "Debt −", style: "bg-amber-50 text-amber-700" },
};

export default function WalletPage() {
  const { getIdToken } = useAdminAuth();
  const [view, setView] = useState<"ledger" | "balances">("ledger");
  const [type, setType] = useState("");
  const [sort, setSort] = useState("debt");
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [tx, setTx] = useState<Tx[]>([]);
  const [riders, setRiders] = useState<RiderRow[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [thresholds, setThresholds] = useState<Thresholds>({ alertKobo: 500000, blockKobo: 800000 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const token = await getIdToken();
      const qs =
        view === "ledger"
          ? `view=ledger&type=${type}&page=${page}&q=${encodeURIComponent(search)}`
          : `view=balances&sort=${sort}&page=${page}&q=${encodeURIComponent(search)}`;
      const res = await fetch(`/api/admin/wallet?${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error || "Something went wrong");
      if (view === "ledger") {
        setTx(d.transactions);
      } else {
        setRiders(d.riders);
        setTotals(d.totals);
        if (d.thresholds) setThresholds(d.thresholds);
      }
      setPages(d.pages || 1);
      setTotal(d.total || 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load wallet data");
    } finally {
      setLoading(false);
    }
  }, [getIdToken, view, type, sort, page, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const doSearch = () => {
    setPage(1);
    setSearch(q);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Wallet &amp; Transactions</h1>
      <p className="mt-1 text-sm text-slate-500">Rider wallets, debt and ledger. Read-only for now.</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {(["ledger", "balances"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => {
              setView(v);
              setPage(1);
            }}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
              view === v ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600"
            }`}
          >
            {v === "ledger" ? "Rider ledger" : "Rider balances"}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {view === "ledger" ? (
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="">All types</option>
            {Object.entries(TYPE_INFO).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        ) : (
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="debt">Highest debt</option>
            <option value="wallet">Highest wallet</option>
            <option value="lifetime">Highest lifetime earnings</option>
          </select>
        )}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && doSearch()}
          placeholder="Search rider name or phone"
          className="w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
        />
        <button type="button" onClick={doSearch} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
          Search
        </button>
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {view === "balances" && totals && !error && (
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { label: "Total rider debt", value: naira(totals.debtKobo) },
            { label: "Total in wallets", value: naira(totals.walletKobo) },
            { label: `Debt over ${naira(thresholds.alertKobo)}`, value: String(totals.overAlert) },
            { label: "Debt-suspended", value: String(totals.debtSuspended) },
          ].map((c) => (
            <div key={c.label} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase text-slate-400">{c.label}</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{c.value}</p>
            </div>
          ))}
        </div>
      )}

      {!error && (
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          {loading ? (
            <p className="p-6 text-sm text-slate-500">Loading…</p>
          ) : view === "ledger" ? (
            tx.length === 0 ? (
              <p className="p-6 text-sm text-slate-500">No transactions found.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {tx.map((t) => {
                  const info = TYPE_INFO[t.type];
                  return (
                    <li key={t._id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-900">{t.label}</p>
                        <p className="truncate text-xs text-slate-500">
                          {t.riderName} · {dateTime(t.createdAt)}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          After: wallet {naira(t.walletBalanceAfterKobo)} · debt {naira(t.debtAfterKobo)}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                          info?.style || "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {info?.label || t.type}
                      </span>
                      <div className="text-right">
                        <p className="text-sm font-bold text-slate-900">{naira(t.amountKobo)}</p>
                        <p className="text-[11px] text-slate-400">
                          {info?.effect ? `${info.effect} · ` : ""}
                          {t.status}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )
          ) : riders.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">No riders with a balance found.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {riders.map((r) => {
                const debtColor =
                  r.debtKobo > thresholds.blockKobo
                    ? "text-red-600"
                    : r.debtKobo >= thresholds.alertKobo
                    ? "text-amber-600"
                    : "text-slate-900";
                return (
                  <li key={r._id} className="flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-900">
                        {r.name}
                        {r.accountSuspended && (
                          <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">
                            Debt-suspended
                          </span>
                        )}
                      </p>
                      <p className="truncate text-xs capitalize text-slate-500">
                        {r.phone || "no phone"} · {r.status}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] text-slate-400">Wallet</p>
                      <p className="text-sm font-bold text-slate-900">{naira(r.walletBalanceKobo)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] text-slate-400">Debt</p>
                      <p className={`text-sm font-bold ${debtColor}`}>{naira(r.debtKobo)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] text-slate-400">Lifetime</p>
                      <p className="text-sm font-bold text-slate-900">{naira(r.lifetimeEarningsKobo)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {pages > 1 && !error && (
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