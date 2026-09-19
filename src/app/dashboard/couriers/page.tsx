"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

interface Courier {
  _id: string;
  firebaseUid: string;
  name: string;
  phone: string;
  vehicleType: string;
  vehiclePlate: string;
  idNumber: string;
  idPhotoUrl: string;
  status: string;
  createdAt: string;
}

export default function CourierQueuePage() {
  const { getIdToken } = useAuth();
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actioningUid, setActioningUid] = useState<string | null>(null);

  const loadPending = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getIdToken();
      const res = await fetch("/api/admin/couriers?status=pending", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load couriers");
      const data = await res.json();
      setCouriers(data.couriers);
    } catch {
      setError("Couldn't load pending couriers. Try refreshing.");
    } finally {
      setLoading(false);
    }
  }, [getIdToken]);

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  async function handleDecision(uid: string, status: "approved" | "rejected") {
    setActioningUid(uid);
    try {
      const token = await getIdToken();
      const res = await fetch(`/api/admin/couriers/${uid}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Update failed");
      setCouriers((prev) => prev.filter((c) => c.firebaseUid !== uid));
    } catch {
      setError("That action failed. Try again.");
    } finally {
      setActioningUid(null);
    }
  }

  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold text-brand">
        Rider approval queue
      </h1>
      <p className="mb-6 text-sm text-slate-500">
        {couriers.length} application{couriers.length === 1 ? "" : "s"} awaiting review
      </p>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : couriers.length === 0 ? (
        <p className="text-sm text-slate-500">No pending applications right now.</p>
      ) : (
        <div className="space-y-4">
          {couriers.map((rider) => (
            <div
              key={rider._id}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-slate-900">{rider.name}</p>
                  <p className="text-sm text-slate-500">{rider.phone}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {rider.vehicleType}
                    {rider.vehiclePlate ? ` · ${rider.vehiclePlate}` : ""}
                    {rider.idNumber ? ` · ID ${rider.idNumber}` : ""}
                  </p>

                  {rider.idPhotoUrl && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <a
                        href={rider.idPhotoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium text-brand-accent underline"
                      >
                        View ID document
                      </a>
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => handleDecision(rider.firebaseUid, "approved")}
                    disabled={actioningUid === rider.firebaseUid}
                    className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleDecision(rider.firebaseUid, "rejected")}
                    disabled={actioningUid === rider.firebaseUid}
                    className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
