"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";

type Form = {
  debtAlert: string; // naira
  debtBlock: string; // naira
  riderShare: string;
  basic: string;
  regular: string;
  premium: string;
  company: string;
  days: number[];
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const input =
  "mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900";

export default function SettingsPage() {
  const { getIdToken } = useAdminAuth();
  const [form, setForm] = useState<Form | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const token = await getIdToken();
      const res = await fetch("/api/admin/settings", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error || "Something went wrong");
      const s = d.settings;
      setForm({
        debtAlert: String(s.debtAlertKobo / 100),
        debtBlock: String(s.debtBlockKobo / 100),
        riderShare: String(s.riderSharePercent),
        basic: String(s.commission.basic),
        regular: String(s.commission.regular),
        premium: String(s.commission.premium),
        company: String(s.companyCommissionPercent),
        days: s.withdrawalDays,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load settings");
    } finally {
      setLoading(false);
    }
  }, [getIdToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setSaved(false);
    setForm((f) => (f ? { ...f, [k]: e.target.value } : f));
  };

  const toggleDay = (d: number) => {
    setSaved(false);
    setForm((f) =>
      f ? { ...f, days: f.days.includes(d) ? f.days.filter((x) => x !== d) : [...f.days, d].sort() } : f
    );
  };

  async function save() {
    if (!form) return;
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const token = await getIdToken();
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          debtAlertKobo: Math.round(Number(form.debtAlert) * 100),
          debtBlockKobo: Math.round(Number(form.debtBlock) * 100),
          riderSharePercent: Number(form.riderShare),
          commission: { basic: Number(form.basic), regular: Number(form.regular), premium: Number(form.premium) },
          companyCommissionPercent: Number(form.company),
          withdrawalDays: form.days,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error || "Could not save");
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Platform Settings</h1>
      <p className="mt-1 text-sm text-slate-500">
        Money rules for the whole platform. Every change is recorded in the audit log.
      </p>

      {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {saved && <p className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">Saved.</p>}
      {loading && <p className="mt-4 text-sm text-slate-500">Loading...</p>}

      {form && !loading && (
        <div className="mt-4 max-w-2xl space-y-5">
          <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <p className="text-sm font-bold text-slate-900">Rider debt limits (&#8358;)</p>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <label className="text-xs font-semibold text-slate-500">
                Alert at
                <input type="number" min={0} value={form.debtAlert} onChange={set("debtAlert")} className={input} />
              </label>
              <label className="text-xs font-semibold text-slate-500">
                Block going online above
                <input type="number" min={0} value={form.debtBlock} onChange={set("debtBlock")} className={input} />
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <p className="text-sm font-bold text-slate-900">Delivery split</p>
            <label className="mt-2 block text-xs font-semibold text-slate-500">
              Rider keeps (%)
              <input type="number" min={50} max={100} value={form.riderShare} onChange={set("riderShare")} className={input} />
            </label>
          </section>

          <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <p className="text-sm font-bold text-slate-900">Vendor commission (%)</p>
            <div className="mt-2 grid grid-cols-3 gap-3">
              {(["basic", "regular", "premium"] as const).map((t) => (
                <label key={t} className="text-xs font-semibold capitalize text-slate-500">
                  {t}
                  <input type="number" min={0} max={50} value={form[t]} onChange={set(t)} className={input} />
                </label>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <p className="text-sm font-bold text-slate-900">Company commission (%)</p>
            <p className="mt-1 text-xs text-slate-500">
              Taken from every technician-company quotation. New quotes use the value at the time they are sent.
            </p>
            <label className="mt-2 block text-xs font-semibold text-slate-500">
              Platform keeps (%)
              <input type="number" min={0} max={50} value={form.company} onChange={set("company")} className={input} />
            </label>
          </section>

          <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <p className="text-sm font-bold text-slate-900">Rider withdrawal days</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {DAYS.map((label, i) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => toggleDay(i)}
                  className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
                    form.days.includes(i)
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {saving ? "Saving..." : "Save settings"}
          </button>
        </div>
      )}
    </div>
  );
}