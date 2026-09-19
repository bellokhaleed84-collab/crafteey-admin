"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/contexts/AdminAuthContext";

type Tab = "new" | "active" | "done" | "cancelled";

type Media = { url: string; type?: "image" | "video" };

type ClientRequest = {
  _id: string;
  category?: string;
  description?: string;
  address?: string;
  clientName?: string;
  clientPhone?: string;
  status?: string;
  technicianUid?: string | null;
  media?: Media[];
  createdAt?: string;
  reviewedByAdmin?: boolean;
  reviewedAt?: string | null;
};

const TABS: { key: Tab; label: string }[] = [
  { key: "new", label: "New" },
  { key: "active", label: "Dispatched" },
  { key: "done", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700",
  dispatched: "bg-blue-50 text-blue-700",
  on_the_way: "bg-blue-50 text-blue-700",
  arrived: "bg-indigo-50 text-indigo-700",
  in_progress: "bg-indigo-50 text-indigo-700",
  completed: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-slate-100 text-slate-600",
};

function posted(iso?: string) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Africa/Lagos",
  }).format(new Date(iso));
}

export default function ClientRequestsPage() {
  const { user, loading, getIdToken } = useAdminAuth();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("new");
  const [requests, setRequests] = useState<ClientRequest[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [listLoading, setListLoading] = useState(true);
  const [error, setError] = useState("");

  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    const token = await getIdToken();
    if (!token) return;
    setListLoading(true);
    try {
      const res = await fetch(`/api/admin/requests?tab=${tab}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Could not load requests.");
        return;
      }
      setError("");
      setRequests(Array.isArray(data.requests) ? data.requests : []);
      setCounts(data.counts && typeof data.counts === "object" ? data.counts : {});
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setListLoading(false);
    }
  }, [getIdToken, tab]);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (user) fetchRequests();
  }, [user, fetchRequests]);

  async function handleAccept(id: string) {
    setActionError(null);
    setActionLoadingId(id);
    try {
      const token = await getIdToken();
      if (!token) throw new Error("You need to be signed in to do that.");
      const res = await fetch(`/api/admin/requests/${id}/accept`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Couldn't accept this request.");
      setRequests((prev) =>
        prev.map((r) => (r._id === id ? { ...r, reviewedByAdmin: true, reviewedAt: new Date().toISOString() } : r))
      );
    } catch (err: any) {
      setActionError(err.message || "Couldn't accept this request.");
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleDecline(id: string) {
    setActionError(null);
    setActionLoadingId(id);
    try {
      const token = await getIdToken();
      if (!token) throw new Error("You need to be signed in to do that.");
      const res = await fetch(`/api/admin/requests/${id}/decline`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Couldn't decline this request.");
      setRequests((prev) => prev.filter((r) => r._id !== id));
      fetchRequests();
    } catch (err: any) {
      setActionError(err.message || "Couldn't decline this request.");
    } finally {
      setActionLoadingId(null);
    }
  }

  if (loading || !user) {
    return <div className="flex items-center justify-center py-20 text-sm text-slate-400">Loading...</div>;
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-bold text-slate-900">Client requests</h2>
        <button
          type="button"
          onClick={fetchRequests}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
        >
          Refresh
        </button>
      </div>

      <div className="mb-5 flex gap-1 overflow-x-auto whitespace-nowrap text-sm font-semibold [scrollbar-width:none]">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            aria-pressed={tab === t.key}
            className={`rounded-lg px-3 py-2 ${
              tab === t.key
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-500 hover:text-slate-900 border border-slate-100"
            }`}
          >
            {t.label}
            <span className={`ml-1.5 text-xs ${tab === t.key ? "text-slate-300" : "text-slate-400"}`}>
              {counts[t.key] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}

      {actionError && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700" role="alert">
          {actionError}
        </div>
      )}

      {listLoading ? (
        <p className="text-sm text-slate-400">Loading...</p>
      ) : requests.length === 0 ? (
        <p className="text-sm text-slate-400">
          {tab === "new" ? "No new requests right now." : "Nothing here yet."}
        </p>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => {
            const media = Array.isArray(r.media) ? r.media : [];
            const status = r.status || "pending";
            const isActing = actionLoadingId === r._id;
            const canAct = tab === "new";
            return (
              <article key={r._id} className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900">{r.category || "No trade picked"}</p>
                    <p className="text-xs text-slate-400 mt-0.5">Posted {posted(r.createdAt)}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${
                        STATUS_STYLE[status] ?? "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {status.replace(/_/g, " ")}
                    </span>
                    {r.reviewedByAdmin && (
                      <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                        ✓ Reviewed
                      </span>
                    )}
                  </div>
                </div>

                <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">
                  {r.description || "No description."}
                </p>

                <p className="mt-3 text-xs text-slate-500">
                  <span className="font-semibold text-slate-600">Where:</span> {r.address || "Not given"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  <span className="font-semibold text-slate-600">Client:</span> {r.clientName || "Unnamed"}
                  {r.clientPhone ? (
                    <>
                      {" · "}
                      <a href={`tel:${r.clientPhone}`} className="underline underline-offset-2">
                        {r.clientPhone}
                      </a>
                    </>
                  ) : null}
                </p>

                {media.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {media.map((m, i) =>
                      m.type === "video" ? (
                        <a
                          key={`${m.url}-${i}`}
                          href={m.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex h-20 w-20 items-center justify-center rounded-lg bg-slate-100 text-xs font-semibold text-slate-600 hover:bg-slate-200"
                        >
                          Play video
                        </a>
                      ) : (
                        <a key={`${m.url}-${i}`} href={m.url} target="_blank" rel="noopener noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={m.url}
                            alt={`Photo ${i + 1} from the client`}
                            loading="lazy"
                            className="h-20 w-20 rounded-lg object-cover bg-slate-100"
                          />
                        </a>
                      )
                    )}
                  </div>
                )}

                {canAct && (
                  <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3">
                    {!r.reviewedByAdmin && (
                      <button
                        type="button"
                        disabled={isActing}
                        onClick={() => handleAccept(r._id)}
                        className="flex-1 rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {isActing ? "…" : "Accept"}
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={isActing}
                      onClick={() => handleDecline(r._id)}
                      className="flex-1 rounded-lg border border-red-200 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                    >
                      {isActing ? "…" : "Decline"}
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}