"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";

type Entry = {
  _id: string;
  actorEmail: string;
  actorName: string | null;
  actorRole: string;
  action: string;
  summary: string;
  createdAt: string;
};

function when(iso: string) {
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Africa/Lagos",
  }).format(new Date(iso));
}

export default function AuditPage() {
  const { getIdToken } = useAdminAuth();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(
    async (before: string | null) => {
      const token = await getIdToken();
      if (!token) return null;
      const qs = before ? `?before=${encodeURIComponent(before)}` : "";
      const res = await fetch(`/api/admin/audit${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Couldn't load the audit log.");
      return data as { entries: Entry[]; nextBefore: string | null };
    },
    [getIdToken]
  );

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchPage(null);
        if (data) {
          setEntries(data.entries);
          setNextBefore(data.nextBefore);
        }
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't load the audit log.");
      } finally {
        setLoading(false);
      }
    })();
  }, [fetchPage]);

  async function loadMore() {
    if (!nextBefore) return;
    setLoadingMore(true);
    try {
      const data = await fetchPage(nextBefore);
      if (data) {
        setEntries((prev) => [...prev, ...data.entries]);
        setNextBefore(data.nextBefore);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load more.");
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold text-slate-900">Audit Log</h1>
      <p className="mb-5 text-sm text-slate-500">A permanent record of what admins did, newest first.</p>

      {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-slate-400">Nothing recorded yet.</p>
      ) : (
        <div className="divide-y divide-slate-100 rounded-2xl border border-slate-100 bg-white shadow-sm">
          {entries.map((e) => (
            <div key={e._id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">{e.summary}</p>
                <span className="text-xs text-slate-400">{when(e.createdAt)}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {e.actorName ?? e.actorEmail} · {e.actorRole.replace(/_/g, " ")} ·{" "}
                <span className="font-mono">{e.action}</span>
              </p>
            </div>
          ))}
        </div>
      )}

      {nextBefore && (
        <button
          type="button"
          onClick={loadMore}
          disabled={loadingMore}
          className="mt-4 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
        >
          {loadingMore ? "Loading…" : "Load more"}
        </button>
      )}
    </div>
  );
}