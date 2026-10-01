"use client";

import { useEffect, useState, useCallback } from "react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { TRADE_OPTIONS } from "@/lib/constants";

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
  const { getIdToken, can } = useAdminAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const canPost = can("jobs.manage");

  // Always a plain array of strings, even if the constants file exports something unexpected.
  const trades: string[] = Array.isArray(TRADE_OPTIONS)
    ? TRADE_OPTIONS.map((t) => String(t))
    : [];

  const fetchJobs = useCallback(async () => {
    const token = await getIdToken();
    if (!token) return;
    setListLoading(true);
    try {
      const res = await fetch("/api/jobs", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        // Accept either [ ...jobs ] or { jobs: [ ...jobs ] }
        const list = Array.isArray(data) ? data : Array.isArray(data?.jobs) ? data.jobs : [];
        setJobs(list);
        setError("");
      } else {
        setError(data?.error || "Couldn't load jobs.");
      }
    } catch {
      // keep whatever list we already have
    } finally {
      setListLoading(false);
    }
  }, [getIdToken]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

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
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {canPost && (
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <h2 className="mb-1 font-bold text-slate-900">Post a new job</h2>
          <p className="mb-5 text-sm text-slate-400">
            Category is picked from the same trade list technicians choose from at registration, so it will always
            match.
          </p>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Category / trade</label>
              <select
                value={form.category}
                onChange={(e) => updateField("category", e.target.value)}
                required
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
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
              <label className="mb-1 block text-xs font-semibold text-slate-500">Price (₦)</label>
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
              <label className="mb-1 block text-xs font-semibold text-slate-500">Client name</label>
              <input
                value={form.clientName}
                onChange={(e) => updateField("clientName", e.target.value)}
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Client phone</label>
              <input
                value={form.clientPhone}
                onChange={(e) => updateField("clientPhone", e.target.value)}
                required
                placeholder="0803 123 4567"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div className="col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-500">Address</label>
              <input
                value={form.address}
                onChange={(e) => updateField("address", e.target.value)}
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Scheduled for</label>
              <input
                value={form.scheduledFor}
                onChange={(e) => updateField("scheduledFor", e.target.value)}
                required
                placeholder="Today, 2:00 PM"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div className="col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-500">Description</label>
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
      )}

      <div>
        <h2 className="mb-3 font-bold text-slate-900">Recent jobs</h2>
        {!canPost && error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}
        {listLoading ? (
          <p className="text-sm text-slate-400">Loading...</p>
        ) : jobs.length === 0 ? (
          <p className="text-sm text-slate-400">No jobs posted yet.</p>
        ) : (
          <div className="space-y-2">
            {jobs.map((job) => (
              <div
                key={job._id}
                className="flex items-start justify-between rounded-xl border border-slate-100 bg-white p-4 shadow-sm"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900">{job.clientName || "Unnamed client"}</p>
                  <p className="text-xs text-slate-400">
                    {job.category || "No category"} · {job.address || "No address"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{job.description || ""}</p>
                </div>
                <div className="ml-4 shrink-0 text-right">
                  <span className="inline-block rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold capitalize text-slate-700">
                    {(job.status || "unknown").replace(/_/g, " ")}
                  </span>
                  <p className="mt-1 text-xs font-bold text-slate-900">
                    ₦{Number(job.price ?? 0).toLocaleString("en-NG")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}