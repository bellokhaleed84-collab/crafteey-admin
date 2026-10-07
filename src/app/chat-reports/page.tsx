"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { dateTime } from "@/lib/format";
import { REPORT_REASON_LABELS, REPORT_STATUS_LABELS } from "@/lib/moderationLabels";

type Row = {
  _id: string;
  companyName: string;
  clientName: string;
  reporterRole: string;
  reason: string;
  details: string;
  status: string;
  createdAt: string;
};

const TABS = ["open", "reviewed", "action_taken", "dismissed", "all"] as const;

const STATUS_STYLE: Record<string, string> = {
  open: "bg-amber-50 text-amber-700",
  reviewed: "bg-blue-50 text-blue-700",
  action_taken: "bg-emerald-50 text-emerald-700",
  dismissed: "bg-slate-100 text-slate-600",
};

export default function ChatReportsPage() {
  const { getIdToken } = useAdminAuth();
  const [tab, setTab] = useState<(typeof TABS)[number]>("open");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [rows, setRows] = useState<Row[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const token = await getIdToken();
      const res = await fetch(`/api/admin/chat-reports?status=${tab}&page=${page}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error || "Something went wrong");
      setRows(d.reports);
      setCounts(d.counts || {});
      setPages(d.pages || 1);
      setTotal(d.total || 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load reports");
    } finally {
      setLoading(false);
    }
  }, [getIdToken, tab, page]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Chat reports</h1>
      <p className="mt-1 text-sm text-slate-500">Chats that a customer or a company reported.</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setTab(t);
              setPage(1);
            }}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
              tab === t ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600"
            }`}
          >
            {t === "all" ? "All" : REPORT_STATUS_LABELS[t]}
            {t !== "all" && counts[t] ? ` (${counts[t]})` : ""}
          </button>
        ))}
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        {loading ? (
          <p className="p-6 text-sm text-slate-500">Loading...</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No reports here.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((r) => (
              <li key={r._id}>
                <Link href={`/chat-reports/${r._id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-slate-50">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-900">
                      {r.companyName} and {r.clientName}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      Reported by the {r.reporterRole === "client" ? "customer" : "company"} - {dateTime(r.createdAt)}
                    </p>
                    <p className="truncate text-xs text-slate-600">
                      {REPORT_REASON_LABELS[r.reason] || r.reason}
                      {r.details ? `: ${r.details}` : ""}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                      STATUS_STYLE[r.status] || "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {REPORT_STATUS_LABELS[r.status] || r.status}
                  </span>
                </Link>
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