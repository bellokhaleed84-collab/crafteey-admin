"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { TRADE_OPTIONS } from "@/lib/constants";
import AdminNav from "@/components/AdminNav";

// Fields are optional on purpose: the jobs collection can contain documents that
// are missing some of them, and one missing field must not crash the whole page.
type Job = {
  _id: string;
  technicianUid?: string | null;
  category?: string;
  clientName?: string;
  clientPhone?: string;
  address?: string;
  scheduledFor?: string;
  price?: number;
  description?: string;
  status?: string;
  completedAt?: string;
  createdAt?: string;
};

const EMPTY_FORM = {
  category: "",
  clientName: "",
  clientPhone: "",
  address: "",
  scheduledFor: "",
  price: "",
  description: "",
};

export default function JobsPage() {
  const { user, loading, getIdToken } = useAdminAuth();
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Always a plain array of strings, even if the constants file exports something unexpected.
  const trades: string[] = Array.isArray(TRADE_OPTIONS)
    ? TRADE_OPTIONS.map((t) => String(t))
    : [];

  const fetchJobs = useCallback(async () => {
    const token = await getIdToken();
    if (!token) return;
    setListLoading(true);
    try {
      const res = await fetch("/api/jobs", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        // Accept either [ ...jobs ] or { jobs: [ ...jobs ] }
        const list = Array.isArray(data) ? data : Array.isArray(data?.jobs) ? data.jobs : [];
        setJobs(list);
      }
    } catch {
      // keep whatever list we already have
    } finally {
      setListLoading(false);
    }
  }, [getIdToken]);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (user) fetchJobs();
  }, [user, fetchJobs]);

  function updateField(field: keyof typeof EMPTY_FORM, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);

    const token = await getIdToken();
    if (!token) {
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Something went wrong");
      } else {
        setSuccess("Job posted.");
        setForm(EMPTY_FORM);
        fetchJobs();
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-slate-400">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminNav />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="font-bold text-slate-900 mb-1">Post a new job</h2>
          <p className="text-sm text-slate-400 mb-5">
            Category is picked from the same trade list technicians choose from at
            registration, so it will always match.
          </p>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-700">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Category / trade</label>
              <select
                value={form.category}
                onChange={(e) => updateField("category", e.target.value)}
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
              >
                <option value="">Select a trade</option>
                {trades.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Price (₦)</label>
              <input
                type="number"
                min="0"
                value={form.price}
                onChange={(e) => updateField("price", e.target.value)}
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Client name</label>
              <input
                value={form.clientName}
                onChange={(e) => updateField("clientName", e.target.value)}
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Client phone</label>
              <input
                value={form.clientPhone}
                onChange={(e) => updateField("clientPhone", e.target.value)}
                required
                placeholder="0803 123 4567"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-500 mb-1">Address</label>
              <input
                value={form.address}
                onChange={(e) => updateField("address", e.target.value)}
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Scheduled for</label>
              <input
                value={form.scheduledFor}
                onChange={(e) => updateField("scheduledFor", e.target.value)}
                required
                placeholder="Today, 2:00 PM"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-500 mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => updateField("description", e.target.value)}
                required
                rows={3}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div className="col-span-2">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {submitting ? "Posting..." : "Post job"}
              </button>
            </div>
          </form>
        </div>

        <div>
          <h2 className="font-bold text-slate-900 mb-3">Recent jobs</h2>
          {listLoading ? (
            <p className="text-sm text-slate-400">Loading...</p>
          ) : jobs.length === 0 ? (
            <p className="text-sm text-slate-400">No jobs posted yet.</p>
          ) : (
            <div className="space-y-2">
              {jobs.map((job) => (
                <div
                  key={job._id}
                  className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm flex items-start justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900">{job.clientName || "Unnamed client"}</p>
                    <p className="text-xs text-slate-400">
                      {job.category || "No category"} · {job.address || "No address"}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">{job.description || ""}</p>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <span className="inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold bg-slate-100 text-slate-700 capitalize">
                      {(job.status || "unknown").replace(/_/g, " ")}
                    </span>
                    <p className="text-xs font-bold text-slate-900 mt-1">
                      ₦{Number(job.price ?? 0).toLocaleString("en-NG")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
