"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { COURIER_STATUS, type CourierStatus } from "@/lib/constants";
import { dateTime } from "@/lib/format";

type Courier = {
  _id: string;
  firebaseUid: string;
  name: string;
  phone: string;
  vehicleType: string;
  vehiclePlate?: string;
  idNumber?: string;
  idPhotoUrl?: string;
  status: CourierStatus;
  isOnline?: boolean;
  createdAt: string;
};

const TABS: { key: CourierStatus; label: string }[] = [
  { key: COURIER_STATUS.PENDING, label: "Pending" },
  { key: COURIER_STATUS.APPROVED, label: "Approved" },
  { key: COURIER_STATUS.REJECTED, label: "Rejected" },
  { key: COURIER_STATUS.SUSPENDED, label: "Suspended" },
  { key: COURIER_STATUS.BLACKLISTED, label: "Blacklisted" },
];

const EMPTY_TEXT: Record<string, string> = {
  pending: "No rider applications waiting.",
  approved: "No approved riders yet.",
  rejected: "No rejected riders.",
  suspended: "No suspended riders.",
  blacklisted: "No blacklisted riders.",
};

export default function RidersPage() {
  const { getIdToken, can } = useAdminAuth();
  const [tab, setTab] = useState<CourierStatus>(COURIER_STATUS.PENDING);
  const [riders, setRiders] = useState<Courier[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [listLoading, setListLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyUid, setBusyUid] = useState<string | null>(null);

  const canReview = can("riders.review");
  const canManage = can("riders.manage");

  const load = useCallback(async () => {
    const token = await getIdToken();
    if (!token) return;
    setListLoading(true);
    try {
      const res = await fetch(`/api/admin/couriers?status=${tab}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Couldn't load riders.");
        return;
      }
      setError("");
      setRiders(Array.isArray(data.couriers) ? data.couriers : []);
      setCounts(data.counts && typeof data.counts === "object" ? data.counts : {});
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setListLoading(false);
    }
  }, [getIdToken, tab]);

  useEffect(() => {
    load();
  }, [load]);

  async function setStatus(rider: Courier, status: CourierStatus, confirmText?: string) {
    if (confirmText && !confirm(confirmText)) return;
    setError("");
    setBusyUid(rider.firebaseUid);
    try {
      const token = await getIdToken();
      if (!token) throw new Error("You need to be signed in to do that.");
      const res = await fetch(`/api/admin/couriers/${rider.firebaseUid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Couldn't update this rider.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update this rider.");
    } finally {
      setBusyUid(null);
    }
  }

  const btn = "rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50";

  function actions(r: Courier) {
    const busy = busyUid === r.firebaseUid;
    const out: React.ReactNode[] = [];

    if (r.status === COURIER_STATUS.PENDING && canReview) {
      out.push(
        <button
          key="reject"
          disabled={busy}
          onClick={() => setStatus(r, COURIER_STATUS.REJECTED, `Reject ${r.name}'s application?`)}
          className={`${btn} border border-slate-300 text-slate-700`}
        >
          Reject
        </button>,
        <button
          key="approve"
          disabled={busy}
          onClick={() => setStatus(r, COURIER_STATUS.APPROVED)}
          className={`${btn} bg-emerald-500 text-white`}
        >
          Approve
        </button>
      );
    }

    if (r.status === COURIER_STATUS.REJECTED && canReview) {
      out.push(
        <button
          key="approve"
          disabled={busy}
          onClick={() => setStatus(r, COURIER_STATUS.APPROVED)}
          className={`${btn} bg-emerald-500 text-white`}
        >
          Approve instead
        </button>
      );
    }

    if (r.status === COURIER_STATUS.APPROVED && canManage) {
      out.push(
        <button
          key="suspend"
          disabled={busy}
          onClick={() => setStatus(r, COURIER_STATUS.SUSPENDED, `Suspend ${r.name}? They won't be able to take new deliveries.`)}
          className={`${btn} border border-amber-300 text-amber-700`}
        >
          Suspend
        </button>,
        <button
          key="blacklist"
          disabled={busy}
          onClick={() => setStatus(r, COURIER_STATUS.BLACKLISTED, `Blacklist ${r.name}? This is for serious problems only.`)}
          className={`${btn} border border-red-200 text-red-600`}
        >
          Blacklist
        </button>
      );
    }

    if (r.status === COURIER_STATUS.SUSPENDED && canManage) {
      out.push(
        <button
          key="reinstate"
          disabled={busy}
          onClick={() => setStatus(r, COURIER_STATUS.APPROVED, `Reinstate ${r.name}?`)}
          className={`${btn} bg-emerald-500 text-white`}
        >
          Reinstate
        </button>,
        <button
          key="blacklist"
          disabled={busy}
          onClick={() => setStatus(r, COURIER_STATUS.BLACKLISTED, `Blacklist ${r.name}? This is for serious problems only.`)}
          className={`${btn} border border-red-200 text-red-600`}
        >
          Blacklist
        </button>
      );
    }

    if (r.status === COURIER_STATUS.BLACKLISTED && canManage) {
      out.push(
        <button
          key="reinstate"
          disabled={busy}
          onClick={() => setStatus(r, COURIER_STATUS.APPROVED, `Lift the blacklist on ${r.name} and approve them again?`)}
          className={`${btn} border border-slate-300 text-slate-700`}
        >
          Reinstate
        </button>
      );
    }

    return out;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Riders</h1>
        <button
          type="button"
          onClick={load}
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
                : "border border-slate-100 bg-white text-slate-500 hover:text-slate-900"
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
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}

      {listLoading ? (
        <p className="text-sm text-slate-400">Loading...</p>
      ) : riders.length === 0 ? (
        <p className="text-sm text-slate-400">{EMPTY_TEXT[tab]}</p>
      ) : (
        <div className="space-y-3">
          {riders.map((r) => {
            const buttons = actions(r);
            return (
              <article key={r._id} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
                      {r.name}
                      {r.status === COURIER_STATUS.APPROVED && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            r.isOnline ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {r.isOnline ? "Online" : "Offline"}
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-sm text-slate-500">
                      <a href={`tel:${r.phone}`} className="underline underline-offset-2">
                        {r.phone}
                      </a>
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {r.vehicleType}
                      {r.vehiclePlate ? ` · ${r.vehiclePlate}` : ""} · Joined {dateTime(r.createdAt)}
                    </p>
                    {(r.idNumber || r.idPhotoUrl) && (
                      <p className="mt-1 text-xs text-slate-500">
                        {r.idNumber && <>ID number: {r.idNumber}</>}
                        {r.idNumber && r.idPhotoUrl && " · "}
                        {r.idPhotoUrl && (
                          <a
                            href={r.idPhotoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold underline underline-offset-2"
                          >
                            View ID photo
                          </a>
                        )}
                      </p>
                    )}
                  </div>
                  {buttons.length > 0 && <div className="flex shrink-0 flex-wrap justify-end gap-2">{buttons}</div>}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}