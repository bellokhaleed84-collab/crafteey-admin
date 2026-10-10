"use client";

import { useCallback, useEffect, useState } from "react";
import { Star } from "lucide-react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { dateTime } from "@/lib/format";

type Row = {
  _id: string;
  reviewerName: string;
  targetType: string;
  targetName: string;
  sourceType: string;
  rating: number;
  comment: string;
  status: string;
  hiddenReason: string | null;
  hiddenBy: string | null;
  hiddenAt: string | null;
  createdAt: string;
};

const TABS = ["published", "hidden", "all"] as const;
const TAB_LABEL: Record<string, string> = { published: "Published", hidden: "Hidden", all: "All" };

const TARGETS = [
  { value: "", label: "Everyone" },
  { value: "company", label: "Companies" },
  { value: "rider", label: "Riders" },
];
const TARGET_LABEL: Record<string, string> = { company: "Company", rider: "Rider", vendor: "Vendor" };
const TARGET_STYLE: Record<string, string> = {
  company: "bg-blue-50 text-blue-700",
  rider: "bg-purple-50 text-purple-700",
  vendor: "bg-amber-50 text-amber-700",
};

function Stars({ value }: { value: number }) {
  return (
    <span className="flex gap-0.5" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={`h-4 w-4 ${n <= value ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />
      ))}
    </span>
  );
}

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

export default function ReviewsPage() {
  const { getIdToken } = useAdminAuth();
  const [tab, setTab] = useState<(typeof TABS)[number]>("published");
  const [target, setTarget] = useState("");
  const [rating, setRating] = useState("");
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [rows, setRows] = useState<Row[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Which review has the "hide" reason box open, and which one is busy.
  const [hidingId, setHidingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const token = await getIdToken();
      const res = await fetch(
        `/api/admin/reviews?status=${tab}&target=${target}&rating=${rating}&page=${page}&q=${encodeURIComponent(search)}`,
        { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
      );
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error || "Something went wrong");
      setRows(d.reviews);
      setCounts(d.counts || {});
      setPages(d.pages || 1);
      setTotal(d.total || 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load reviews");
    } finally {
      setLoading(false);
    }
  }, [getIdToken, tab, target, rating, page, search]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(r: Row, action: "hide" | "unhide" | "recalculate", extra: Record<string, unknown> = {}) {
    setBusyId(r._id);
    setError("");
    setNotice("");
    try {
      const token = await getIdToken();
      const res = await fetch(`/api/admin/reviews/${r._id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error || "Couldn't save that.");
      setNotice(
        `${r.targetName} now has a rating of ${Number(d.rating).toFixed(1)} from ${d.count} published review${
          d.count === 1 ? "" : "s"
        }.`
      );
      setHidingId(null);
      setReason("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that.");
    } finally {
      setBusyId(null);
    }
  }

  function doSearch() {
    setPage(1);
    setSearch(q);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Reviews</h1>
      <p className="mt-1 text-sm text-slate-500">
        Customer reviews of companies and riders. Hidden reviews disappear from the apps and no longer count toward the
        rating.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {TARGETS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => {
              setTarget(t.value);
              setPage(1);
              setHidingId(null);
            }}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
              target === t.value ? "bg-blue-600 text-white" : "border border-slate-200 bg-white text-slate-600"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setTab(t);
              setPage(1);
              setHidingId(null);
            }}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
              tab === t ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600"
            }`}
          >
            {TAB_LABEL[t]}
            <span className={`ml-1.5 text-xs ${tab === t ? "text-slate-300" : "text-slate-400"}`}>
              {counts[t] ?? 0}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <select
          value={rating}
          onChange={(e) => {
            setRating(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
        >
          <option value="">All ratings</option>
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              {n} star{n > 1 ? "s" : ""}
            </option>
          ))}
        </select>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && doSearch()}
          placeholder="Search company, rider or customer name"
          className="w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
        />
        <button type="button" onClick={doSearch} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
          Search
        </button>
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {notice && <p className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">{notice}</p>}

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        {loading ? (
          <RowSkeletons />
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No reviews here.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((r) => {
              const busy = busyId === r._id;
              const hiding = hidingId === r._id;
              return (
                <li key={r._id} className="px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                            TARGET_STYLE[r.targetType] || "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {TARGET_LABEL[r.targetType] || r.targetType}
                        </span>
                        <p className="text-sm font-bold text-slate-900">{r.targetName}</p>
                        <Stars value={r.rating} />
                        {r.status === "hidden" && (
                          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-600">
                            Hidden
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        by {r.reviewerName} - {dateTime(r.createdAt)}
                      </p>
                      {r.comment ? (
                        <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-700">{r.comment}</p>
                      ) : (
                        <p className="mt-2 text-xs italic text-slate-400">No comment.</p>
                      )}
                      {r.status === "hidden" && (
                        <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
                          Hidden{r.hiddenBy ? ` by ${r.hiddenBy}` : ""}
                          {r.hiddenAt ? ` on ${dateTime(r.hiddenAt)}` : ""}
                          {r.hiddenReason ? `: ${r.hiddenReason}` : ""}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-2">
                      {r.status === "published" ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setHidingId(hiding ? null : r._id);
                            setReason("");
                          }}
                          className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 disabled:opacity-50"
                        >
                          {hiding ? "Cancel" : "Hide"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void act(r, "unhide")}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          {busy ? "Saving..." : "Restore"}
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void act(r, "recalculate")}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-50"
                      >
                        Recalculate rating
                      </button>
                    </div>
                  </div>

                  {hiding && (
                    <div className="mt-3 space-y-2 rounded-xl bg-slate-50 p-3">
                      <textarea
                        rows={2}
                        maxLength={300}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Why is this review being hidden? (at least 5 characters)"
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                      />
                      <button
                        type="button"
                        disabled={busy || reason.trim().length < 5}
                        onClick={() => void act(r, "hide", { reason })}
                        className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
                      >
                        {busy ? "Saving..." : "Hide this review"}
                      </button>
                    </div>
                  )}
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