"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { dateTime } from "@/lib/format";
import { LOCK_REASON_LABELS } from "@/lib/moderationLabels";

type Row = { _id: string; role: string; sender: string; companyName: string; text: string; reason: string; createdAt: string };
type Repeat = { key: string; role: string; sender: string; count: number; last: string };

const RANGES = [
  { value: "24h", label: "24 hours" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "all", label: "All time" },
];

export default function BlockedMessagesPage() {
  const { getIdToken } = useAdminAuth();
  const [range, setRange] = useState("7d");
  const [reason, setReason] = useState("");
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [rows, setRows] = useState<Row[]>([]);
  const [byReason, setByReason] = useState<Record<string, number>>({});
  const [repeat, setRepeat] = useState<Repeat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const token = await getIdToken();
      const res = await fetch(
        `/api/admin/blocked-messages?range=${range}&reason=${reason}&page=${page}&q=${encodeURIComponent(search)}`,
        { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
      );
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error || "Something went wrong");
      setRows(d.blocked);
      setByReason(d.byReason || {});
      setRepeat(d.repeat || []);
      setPages(d.pages || 1);
      setTotal(d.total || 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load blocked messages");
    } finally {
      setLoading(false);
    }
  }, [getIdToken, range, reason, page, search]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Blocked messages</h1>
      <p className="mt-1 text-sm text-slate-500">Messages the contact lock stopped. They were never delivered.</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {RANGES.map((r) => (
          <button
            key={r.value}
            type="button"
            onClick={() => {
              setRange(r.value);
              setPage(1);
            }}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
              range === r.value ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {Object.keys(LOCK_REASON_LABELS).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              setReason(reason === k ? "" : k);
              setPage(1);
            }}
            className={`rounded-2xl border p-3 text-left shadow-sm ${
              reason === k ? "border-slate-900 bg-slate-900 text-white" : "border-slate-100 bg-white"
            }`}
          >
            <p className={`text-[11px] font-semibold uppercase ${reason === k ? "text-slate-300" : "text-slate-400"}`}>
              {LOCK_REASON_LABELS[k]}
            </p>
            <p className="mt-1 text-lg font-bold">{byReason[k] ?? 0}</p>
          </button>
        ))}
      </div>

      {repeat.length > 0 && (
        <section className="mt-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-sm font-bold text-slate-900">Repeat attempts</p>
          <ul className="mt-2 divide-y divide-slate-100">
            {repeat.map((o) => (
              <li key={o.key} className="flex items-center justify-between py-2 text-sm">
                <span className="text-slate-900">
                  {o.sender} <span className="text-xs text-slate-400">({o.role === "company" ? "company" : "customer"})</span>
                </span>
                <span className="text-xs text-slate-500">
                  {o.count} blocked - last {dateTime(o.last)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

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
          placeholder="Search company name or user id"
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
          <p className="p-6 text-sm text-slate-500">Loading...</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No blocked messages found.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((b) => (
              <li key={b._id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <p className="text-sm font-bold text-slate-900">
                    {b.sender} <span className="text-xs font-normal text-slate-400">({b.role === "company" ? "company" : "customer"})</span>
                  </p>
                  <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700">
                    {LOCK_REASON_LABELS[b.reason] || b.reason}
                  </span>
                  <span className="text-xs text-slate-400">{dateTime(b.createdAt)}</span>
                </div>
                {b.role === "client" && b.companyName && (
                  <p className="text-xs text-slate-500">Chat with {b.companyName}</p>
                )}
                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">{b.text}</p>
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
            Page {page} of {pages} - {total} total
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