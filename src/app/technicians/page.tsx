"use client";

import { useEffect, useState, useCallback } from "react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";

type Technician = {
  _id: string;
  firebaseUid: string;
  name: string;
  email: string;
  phone: string;
  categories: string[];
  yearsExperience: number;
  baseArea: string;
  status: "pending" | "approved" | "rejected" | "suspended" | "blacklisted";
  createdAt: string;
};

export default function TechniciansPage() {
  const { getIdToken, can } = useAdminAuth();
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [filter, setFilter] = useState<string>("pending");
  const [listLoading, setListLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canReview = can("technicians.review");

  const fetchTechnicians = useCallback(async () => {
    const token = await getIdToken();
    if (!token) return;
    setListLoading(true);
    try {
      const res = await fetch(`/api/technicians?status=${filter}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Couldn't load technicians.");
      setTechnicians(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load technicians.");
    } finally {
      setListLoading(false);
    }
  }, [getIdToken, filter]);

  useEffect(() => {
    fetchTechnicians();
  }, [fetchTechnicians]);

  async function updateStatus(uid: string, status: string) {
    const token = await getIdToken();
    if (!token) return;
    try {
      const res = await fetch(`/api/technicians/${uid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Couldn't update this technician.");
      setError(null);
      fetchTechnicians();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update this technician.");
    }
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold text-slate-900">Technician applications</h1>

      <div className="mb-6 flex gap-2">
        {["pending", "approved", "rejected"].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold capitalize ${
              filter === s ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-600"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {listLoading ? (
        <p className="text-sm text-slate-400">Loading...</p>
      ) : technicians.length === 0 ? (
        <p className="text-sm text-slate-400">No {filter} applications.</p>
      ) : (
        <div className="space-y-3">
          {technicians.map((t) => (
            <div key={t._id} className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-slate-900">{t.name}</p>
                  <p className="text-sm text-slate-500">
                    {t.email} · {t.phone}
                  </p>
                  <p className="text-sm text-slate-500 mt-1">
                    {t.categories.join(", ")} · {t.yearsExperience} yrs · {t.baseArea}
                  </p>
                </div>
                {filter === "pending" && canReview && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateStatus(t.firebaseUid, "rejected")}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => updateStatus(t.firebaseUid, "approved")}
                      className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      Approve
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}