"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import AdminNav from "@/components/AdminNav";

type CourierStatus = "pending" | "approved" | "rejected" | "suspended" | "blacklisted";

type Courier = {
  _id: string;
  firebaseUid: string;
  name?: string;
  phone?: string;
  vehicleType?: string;
  vehiclePlate?: string;
  idNumber?: string;
  idPhotoUrl?: string;
  status: CourierStatus;
  isOnline?: boolean;
  createdAt?: string;
};

const TABS: { key: CourierStatus; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "suspended", label: "Suspended" },
  { key: "blacklisted", label: "Blacklisted" },
];

type Action = { label: string; status: CourierStatus; tone: "good" | "bad"; confirm?: string };

const ACTIONS: Record<CourierStatus, Action[]> = {
  pending: [
    { label: "Approve", status: "approved", tone: "good" },
    { label: "Reject", status: "rejected", tone: "bad", confirm: "Reject this rider?" },
  ],
  approved: [
    { label: "Suspend", status: "suspended", tone: "bad", confirm: "Suspend this rider? They will stop getting requests." },
    { label: "Blacklist", status: "blacklisted", tone: "bad", confirm: "Blacklist this rider?" },
  ],
  rejected: [{ label: "Approve instead", status: "approved", tone: "good" }],
  suspended: [
    { label: "Reinstate", status: "approved", tone: "good" },
    { label: "Blacklist", status: "blacklisted", tone: "bad", confirm: "Blacklist this rider?" },
  ],
  blacklisted: [
    { label: "Reinstate", status: "approved", tone: "good", confirm: "Reinstate a blacklisted rider?" },
  ],
};

const STATUS_STYLE: Record<CourierStatus, string> = {
  pending: "bg-amber-50 text-amber-700",
  approved: "bg-emerald-50 text-emerald-700",
  rejected: "bg-slate-100 text-slate-600",
  suspended: "bg-orange-50 text-orange-700",
  blacklisted: "bg-red-50 text-red-700",
};

function joined(iso?: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

export default function RidersPage() {
  const { user, loading, getIdToken } = useAdminAuth();
  const router = useRouter();

  const [tab, setTab] = useState<CourierStatus>("pending");
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [listLoading, setListLoading] = useState(true);
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [error, setError] = useState("");

  const fetchCouriers = useCallback(async () => {
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
        setError(data?.error || "Could not load riders.");
        return;
      }
      setError("");
      setCouriers(Array.isArray(data.couriers) ? data.couriers : []);
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
    if (user) fetchCouriers();
  }, [user, fetchCouriers]);

  async function changeStatus(courier: Courier, action: Action) {
    if (action.confirm && !window.confirm(action.confirm)) return;

    const token = await getIdToken();
    if (!token) return;

    setBusyUid(courier.firebaseUid);
    setError("");
    try {
      const res = await fetch(`/api/admin/couriers/${courier.firebaseUid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: action.status }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || "Could not update this rider.");
      } else {
        await fetchCouriers();
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusyUid(null);
    }
  }

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-slate-400">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminNav />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <h2 className="font-bold text-slate-900 mb-4">Riders</h2>

        <div className="mb-5 flex gap-1 overflow-x-auto whitespace-nowrap text-sm font-semibold [scrollbar-width:none]">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              aria-pressed={tab === t.key}
              className={`rounded-lg px-3 py-2 ${
                tab === t.key ? "bg-slate-900 text-white" : "bg-white text-slate-500 hover:text-slate-900 border border-slate-100"
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

        {listLoading ? (
          <p className="text-sm text-slate-400">Loading...</p>
        ) : couriers.length === 0 ? (
          <p className="text-sm text-slate-400">No {tab} riders.</p>
        ) : (
          <div className="space-y-3">
            {couriers.map((c) => (
              <div key={c._id} className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${c.isOnline ? "bg-emerald-500" : "bg-slate-300"}`}
                        title={c.isOnline ? "Online" : "Offline"}
                      />
                      <p className="text-sm font-bold text-slate-900 truncate">{c.name || "Unnamed rider"}</p>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {c.phone ? (
                        <a href={`tel:${c.phone}`} className="underline underline-offset-2">
                          {c.phone}
                        </a>
                      ) : (
                        "No phone"
                      )}
                      {" · "}
                      {c.vehicleType || "No vehicle"}
                      {c.vehiclePlate ? ` · ${c.vehiclePlate}` : ""}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      ID number: {c.idNumber || "not given"}
                      {c.idPhotoUrl && (
                        <>
                          {" · "}
                          <a
                            href={c.idPhotoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-700 underline underline-offset-2"
                          >
                            View ID photo
                          </a>
                        </>
                      )}
                    </p>
                    {c.createdAt && <p className="text-xs text-slate-400 mt-1">Joined {joined(c.createdAt)}</p>}
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${STATUS_STYLE[c.status] ?? "bg-slate-100 text-slate-600"}`}
                  >
                    {c.status}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {(ACTIONS[c.status] ?? []).map((a) => (
                    <button
                      key={a.label}
                      type="button"
                      disabled={busyUid === c.firebaseUid}
                      onClick={() => changeStatus(c, a)}
                      className={`rounded-lg px-3.5 py-2 text-xs font-semibold disabled:opacity-50 ${
                        a.tone === "good"
                          ? "bg-slate-900 text-white hover:bg-slate-800"
                          : "border border-red-200 text-red-600 hover:bg-red-50"
                      }`}
                    >
                      {busyUid === c.firebaseUid ? "Saving..." : a.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
