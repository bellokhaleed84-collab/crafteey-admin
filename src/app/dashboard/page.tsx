"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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

export default function DashboardPage() {
  const { user, loading, getIdToken, signOut } = useAdminAuth();
  const router = useRouter();
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [filter, setFilter] = useState<string>("pending");
  const [listLoading, setListLoading] = useState(true);

  const fetchTechnicians = useCallback(async () => {
    const token = await getIdToken();
    if (!token) return;
    setListLoading(true);
    const res = await fetch(`/api/technicians?status=${filter}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setTechnicians(await res.json());
    }
    setListLoading(false);
  }, [getIdToken, filter]);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (user) fetchTechnicians();
  }, [user, fetchTechnicians]);

  async function updateStatus(uid: string, status: string) {
    const token = await getIdToken();
    if (!token) return;
    await fetch(`/api/technicians/${uid}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status }),
    });
    fetchTechnicians();
  }

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-slate-400">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <h1 className="font-bold text-lg text-slate-900">Crafteey Admin</h1>
          <nav className="flex gap-4 text-sm font-semibold">
            <Link href="/dashboard" className="text-slate-900">
              Applications
            </Link>
            <Link href="/jobs" className="text-slate-500 hover:text-slate-900">
              Jobs
            </Link>
          </nav>
        </div>
        <button onClick={signOut} className="text-sm font-semibold text-slate-500 hover:text-slate-900">
          Sign out
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex gap-2 mb-6">
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
                    <p className="text-sm text-slate-500">{t.email} · {t.phone}</p>
                    <p className="text-sm text-slate-500 mt-1">
                      {t.categories.join(", ")} · {t.yearsExperience} yrs · {t.baseArea}
                    </p>
                  </div>
                  {filter === "pending" && (
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
      </main>
    </div>
  );
}
