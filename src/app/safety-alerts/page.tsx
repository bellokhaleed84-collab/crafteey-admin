"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { dateTime } from "@/lib/format";

type Row = {
  _id: string;
  kind: string;
  requestId: string;
  courierName: string;
  courierPhone: string;
  clientName: string;
  pickup: string;
  dropoff: string;
  source: string;
  orderNumber: string | null;
  reason: string;
  note: string;
  location: { lat: number; lng: number } | null;
  status: string;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
};

const TABS = ["open", "resolved", "all"] as const;
const TAB_LABEL: Record<string, string> = { open: "Open", resolved: "Fixed", all: "All" };

const KINDS = [
  { value: "", label: "All types" },
  { value: "emergency", label: "SOS" },
  { value: "gave_up", label: "Gave up job" },
  { value: "problem", label: "Problem (old)" },
];

const KIND_LABEL: Record<string, string> = {
  emergency: "SOS",
  gave_up: "Gave up job",
  problem: "Problem",
};
const KIND_STYLE: Record<string, string> = {
  emergency: "bg-red-600 text-white",
  gave_up: "bg-amber-100 text-amber-800",
  problem: "bg-slate-100 text-slate-700",
};

const REFRESH_MS = 20000;

function RowSkeletons() {
  return (
    <div className="space-y-3 p-4" aria-busy="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="animate-pulse space-y-2 rounded-xl border border-slate-100 p-4">
          <div className="h-4 w-1/3 rounded bg-slate-200" />
          <div className="h-3 w-1/4 rounded bg-slate-100" />
          <div className="h-3 w-3/4 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

export default function SafetyAlertsPage() {
  const { getIdToken, can } = useAdminAuth();
  const [tab, setTab] = useState<(typeof TABS)[number]>("open");
  const [kind, setKind] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [rows, setRows] = useState<Row[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [openSos, setOpenSos] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const firstLoad = useRef(true);

  const load = useCallback(
    async (silent: boolean) => {
      if (!silent) setLoading(true);
      try {
        const token = await getIdToken();
        const res = await fetch(`/api/admin/safety-alerts?status=${tab}&kind=${kind}&page=${page}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(d?.error || "Something went wrong");
        setRows(d.reports);
        setCounts(d.counts || {});
        setOpenSos(d.openSos || 0);
        setPages(d.pages || 1);
        setTotal(d.total || 0);
        setError("");
      } catch (e) {
        if (!silent) setError(e instanceof Error ? e.message : "Could not load alerts");
      } finally {
        if (!silent) setLoading(false);
        firstLoad.current = false;
      }
    },
    [getIdToken, tab, kind, page]
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  // Keep the list fresh so a new SOS shows up without a refresh.
  useEffect(() => {
    const t = setInterval(() => void load(true), REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  async function setStatus(r: Row, status: "resolved" | "open") {
    setBusyId(r._id);
    setError("");
    try {
      const token = await getIdToken();
      const res = await fetch(`/api/admin/safety-alerts/${r._id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error || "Couldn't save that.");
      await load(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that.");
    } finally {
      setBusyId(null);
    }
  }

  const canManage = can("riders.manage");

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Safety alerts</h1>
      <p className="mt-1 text-sm text-slate-500">
        SOS alerts and jobs that riders gave back. Press Mark fixed when it is sorted. This list refreshes by itself.
      </p>

      {openSos > 0 && (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">
          {openSos} open SOS alert{openSos === 1 ? "" : "s"}. Call the rider now.
        </p>
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
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
              tab === t ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600"
            }`}
          >
            {TAB_LABEL[t]}
            <span className={`ml-1.5 text-xs ${tab === t ? "text-slate-300" : "text-slate-400"}`}>{counts[t] ?? 0}</span>
          </button>
        ))}
        <select
          value={kind}
          onChange={(e) => {
            setKind(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm"
        >
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        {loading ? (
          <RowSkeletons />
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">Nothing here.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((r) => {
              const busy = busyId === r._id;
              const resolved = r.status === "resolved";
              return (
                <li key={r._id} className="px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                            KIND_STYLE[r.kind] || "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {KIND_LABEL[r.kind] || r.kind}
                        </span>
                        <p className="text-sm font-bold text-slate-900">{r.courierName}</p>
                        {r.courierPhone && (
                          <a href={`tel:${r.courierPhone}`} className="text-sm font-semibold text-blue-600">
                            {r.courierPhone}
                          </a>
                        )}
                        {resolved && (
                          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                            Fixed
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {dateTime(r.createdAt)} - {r.source === "hub" ? "Hub order" : "Direct ride"}
                        {r.orderNumber ? ` ${r.orderNumber}` : ""}
                        {r.clientName ? ` - customer ${r.clientName}` : ""}
                      </p>
                      {r.reason && <p className="mt-2 text-sm font-semibold text-slate-800">{r.reason}</p>}
                      {r.note && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">{r.note}</p>}
                      <p className="mt-2 text-xs text-slate-500">
                        {r.pickup} to {r.dropoff}
                      </p>
                      {r.location && (
                        <a
                          href={`https://www.google.com/maps?q=${r.location.lat},${r.location.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-block text-xs font-semibold text-blue-600"
                        >
                          Open rider location in Google Maps
                        </a>
                      )}
                      {resolved && (
                        <p className="mt-2 text-xs text-slate-400">
                          Fixed{r.resolvedBy ? ` by ${r.resolvedBy}` : ""}
                          {r.resolvedAt ? ` on ${dateTime(r.resolvedAt)}` : ""}
                        </p>
                      )}
                    </div>

                    {canManage && (
                      <div className="shrink-0">
                        {resolved ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void setStatus(r, "open")}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-50"
                          >
                            {busy ? "Saving..." : "Reopen"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void setStatus(r, "resolved")}
                            className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                          >
                            {busy ? "Saving..." : "Mark fixed"}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
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