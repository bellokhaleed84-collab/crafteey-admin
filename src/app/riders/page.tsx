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
  rejectionReason?: string;
  resubmittedAt?: string | null;
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

// Quick reasons the admin can tap to fill the box, then edit.
const REASON_CHIPS = [
  "The document photo is blurry or cut off.",
  "The document is not valid or has expired.",
  "The name on the document does not match your profile.",
  "Please use a NIN, Driver's Licence or Voter's Card.",
];

function ListSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="animate-pulse rounded-xl border border-slate-100 bg-white p-4">
          <div className="h-4 w-1/3 rounded bg-slate-200" />
          <div className="mt-3 h-3 w-1/2 rounded bg-slate-100" />
          <div className="mt-2 h-3 w-2/3 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

export default function RidersPage() {
  const { getIdToken, can } = useAdminAuth();
  const [tab, setTab] = useState<CourierStatus>(COURIER_STATUS.PENDING);
  const [riders, setRiders] = useState<Courier[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [listLoading, setListLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [rejectUid, setRejectUid] = useState<string | null>(null);
  const [reasonText, setReasonText] = useState("");

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

  async function setStatus(
    rider: Courier,
    status: CourierStatus,
    confirmText?: string,
    reason?: string
  ): Promise<boolean> {
    if (confirmText && !confirm(confirmText)) return false;
    setError("");
    setBusyUid(rider.firebaseUid);
    try {
      const token = await getIdToken();
      if (!token) throw new Error("You need to be signed in to do that.");
      const res = await fetch(`/api/admin/couriers/${rider.firebaseUid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(reason ? { status, rejectionReason: reason } : { status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Couldn't update this rider.");
      await load();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update this rider.");
      return false;
    } finally {
      setBusyUid(null);
    }
  }

  function openReject(r: Courier) {
    setError("");
    setReasonText("");
    setRejectUid(rejectUid === r.firebaseUid ? null : r.firebaseUid);
  }

  async function sendRejection(r: Courier) {
    const reason = reasonText.trim();
    if (reason.length < 5) {
      setError("Write a reason for the rider (at least 5 characters).");
      return;
    }
    const ok = await setStatus(r, COURIER_STATUS.REJECTED, undefined, reason);
    if (ok) {
      setRejectUid(null);
      setReasonText("");
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
          onClick={() => openReject(r)}
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
            onClick={() => {
              setTab(t.key);
              setRejectUid(null);
              setReasonText("");
            }}
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
        <ListSkeleton />
      ) : riders.length === 0 ? (
        <p className="text-sm text-slate-400">{EMPTY_TEXT[tab]}</p>
      ) : (
        <div className="space-y-3">
          {riders.map((r) => {
            const buttons = actions(r);
            const busy = busyUid === r.firebaseUid;
            return (
              <article key={r._id} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-900">
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
                      {r.status === COURIER_STATUS.PENDING && r.resubmittedAt && (
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                          New document sent
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
                    {r.status === COURIER_STATUS.PENDING && r.resubmittedAt && (
                      <p className="mt-1 text-xs text-blue-700">
                        Sent a new document on {dateTime(r.resubmittedAt)}
                      </p>
                    )}
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

                {r.status === COURIER_STATUS.REJECTED && (
                  <div className="mt-3 space-y-1">
                    <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                      <span className="font-semibold">Reason the rider sees:</span>{" "}
                      {r.rejectionReason || "No reason was saved for this one."}
                    </p>
                    <p className="text-xs text-slate-400">
                      Waiting for the rider to upload a new document. It will move to Pending when they do.
                    </p>
                  </div>
                )}

                {rejectUid === r.firebaseUid && (
                  <div className="mt-3 space-y-3 rounded-lg bg-slate-50 p-3">
                    <p className="text-xs font-semibold text-slate-700">
                      Tell {r.name} what to fix. They will see this and can upload a new document.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {REASON_CHIPS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setReasonText(c)}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 hover:text-slate-900"
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={reasonText}
                      onChange={(e) => setReasonText(e.target.value)}
                      maxLength={300}
                      rows={3}
                      placeholder="Reason (at least 5 characters)"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={busy || reasonText.trim().length < 5}
                        onClick={() => sendRejection(r)}
                        className={`${btn} bg-red-600 text-white disabled:opacity-40`}
                      >
                        Reject and send reason
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setRejectUid(null);
                          setReasonText("");
                        }}
                        className={`${btn} border border-slate-300 text-slate-700`}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}