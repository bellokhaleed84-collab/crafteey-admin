"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";

type Row = {
  _id: string;
  slug: string;
  title: string;
  description: string;
  icon: string;
  group: string;
  body: string;
  order: number;
  enabled: boolean;
};

type FormState = {
  id?: string;
  title: string;
  description: string;
  icon: string;
  group: string;
  body: string;
  enabled: boolean;
};

const EMPTY: FormState = {
  title: "",
  description: "",
  icon: "\uD83D\uDCCC",
  group: "more",
  body: "",
  enabled: true,
};

const QUICK_ICONS = [
  "\uD83C\uDF81",
  "\uD83D\uDCCC",
  "\uD83D\uDCE3",
  "\uD83D\uDEE1\uFE0F",
  "\uD83D\uDCA1",
  "\uD83C\uDFC6",
  "\uD83D\uDCDE",
  "\uD83D\uDCC4",
];

const INPUT = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900";

export default function RiderSectionsPage() {
  const { getIdToken } = useAdminAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  const api = useCallback(
    async (url: string, method = "GET", body?: unknown) => {
      const token = await getIdToken();
      const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
      if (body !== undefined) headers["Content-Type"] = "application/json";
      const res = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        cache: "no-store",
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error || "Something went wrong");
      return d;
    },
    [getIdToken]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const d = await api("/api/admin/rider-sections");
      setRows(d.sections);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the sections");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  function openEdit(r: Row) {
    setNotice("");
    setError("");
    setForm({
      id: r._id,
      title: r.title,
      description: r.description,
      icon: r.icon,
      group: r.group,
      body: r.body,
      enabled: r.enabled,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save() {
    if (!form) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const payload = {
        title: form.title,
        description: form.description,
        icon: form.icon,
        group: form.group,
        body: form.body,
        enabled: form.enabled,
      };
      if (form.id) await api(`/api/admin/rider-sections/${form.id}`, "PATCH", payload);
      else await api("/api/admin/rider-sections", "POST", payload);
      setNotice(form.id ? "Section saved." : "Section added.");
      setForm(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that.");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(r: Row) {
    setBusyId(r._id);
    setError("");
    setNotice("");
    try {
      await api(`/api/admin/rider-sections/${r._id}`, "PATCH", { enabled: !r.enabled });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that.");
    } finally {
      setBusyId(null);
    }
  }

  async function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= rows.length) return;
    const ids = rows.map((r) => r._id);
    [ids[i], ids[j]] = [ids[j], ids[i]];
    setBusyId(rows[i]._id);
    setError("");
    try {
      await api("/api/admin/rider-sections", "PUT", { ids });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't change the order.");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(r: Row) {
    if (!window.confirm(`Delete "${r.title}"? Switching it off instead keeps it for later.`)) return;
    setBusyId(r._id);
    setError("");
    setNotice("");
    try {
      await api(`/api/admin/rider-sections/${r._id}`, "DELETE");
      setNotice("Section deleted.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete that.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Rider Settings sections</h1>
          <p className="mt-1 text-sm text-slate-500">
            Extra sections that appear in the rider app's Settings list, after the built-in ones. Add things like Promotions,
            Referrals or Rules. Each opens a page with the text you write.
          </p>
        </div>
        {!form && (
          <button
            type="button"
            onClick={() => {
              setNotice("");
              setError("");
              setForm({ ...EMPTY });
            }}
            className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            <Plus size={16} /> Add section
          </button>
        )}
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {notice && <p className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">{notice}</p>}

      {form && (
        <div className="mt-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-base font-bold text-slate-900">{form.id ? "Edit section" : "New section"}</h2>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-slate-600">
              Title (max 40)
              <input className={`${INPUT} mt-1`} maxLength={40} value={form.title} onChange={(e) => set("title", e.target.value)} />
            </label>
            <label className="block text-xs font-semibold text-slate-600">
              Short description (max 100, shown in the top list only)
              <input
                className={`${INPUT} mt-1`}
                maxLength={100}
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
              />
            </label>

            <div className="sm:col-span-2">
              <p className="text-xs font-semibold text-slate-600">Icon</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {QUICK_ICONS.map((ic) => (
                  <button
                    key={ic}
                    type="button"
                    onClick={() => set("icon", ic)}
                    className={`h-10 w-10 rounded-lg text-xl ${
                      form.icon === ic ? "bg-slate-900" : "border border-slate-200 bg-white"
                    }`}
                  >
                    {ic}
                  </button>
                ))}
                <label className="text-xs font-semibold text-slate-600">
                  Or type your own emoji
                  <input
                    className={`${INPUT} mt-1 w-24`}
                    maxLength={8}
                    value={form.icon}
                    onChange={(e) => set("icon", e.target.value)}
                  />
                </label>
              </div>
            </div>

            <div className="sm:col-span-2">
              <p className="text-xs font-semibold text-slate-600">Where it shows in the rider's Settings</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {[
                  { v: "core", l: "Top list (with description)" },
                  { v: "more", l: "More settings" },
                ].map((g) => (
                  <button
                    key={g.v}
                    type="button"
                    onClick={() => set("group", g.v)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                      form.group === g.v ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600"
                    }`}
                  >
                    {g.l}
                  </button>
                ))}
              </div>
            </div>

            <label className="block text-xs font-semibold text-slate-600 sm:col-span-2">
              Page text
              <textarea
                className={`${INPUT} mt-1 font-mono`}
                rows={12}
                maxLength={20000}
                value={form.body}
                onChange={(e) => set("body", e.target.value)}
              />
            </label>
            <p className="text-[11px] text-slate-500 sm:col-span-2">
              A heading: start the line with <b># </b>. A new paragraph: leave one empty line. A bullet list: start each line
              with <b>- </b> and keep the lines together.
            </p>

            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 sm:col-span-2">
              <input type="checkbox" checked={form.enabled} onChange={(e) => set("enabled", e.target.checked)} />
              Switched on
            </label>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={saving || !form.title.trim() || !form.body.trim()}
              onClick={() => void save()}
              className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              {saving ? "Saving..." : "Save section"}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => setForm(null)}
              className="rounded-lg border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        {loading ? (
          <div className="space-y-3 p-4" aria-busy="true">
            {[0, 1].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">
            No extra sections yet. The rider's Settings shows only the built-in ones. Tap Add section to create one, like
            Promotions.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((r, i) => {
              const busy = busyId === r._id;
              return (
                <li key={r._id} className="flex flex-wrap items-center gap-4 px-4 py-4">
                  <span className="text-2xl">{r.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-slate-900">{r.title}</p>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                          r.enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {r.enabled ? "On" : "Off"}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-600">
                        {r.group === "core" ? "Top list" : "More settings"}
                      </span>
                    </div>
                    {r.description && <p className="mt-1 text-xs text-slate-500">{r.description}</p>}
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={busy || i === 0}
                      onClick={() => void move(i, -1)}
                      aria-label="Move up"
                      className="rounded-lg border border-slate-200 p-2 text-slate-600 disabled:opacity-30"
                    >
                      <ArrowUp size={15} />
                    </button>
                    <button
                      type="button"
                      disabled={busy || i === rows.length - 1}
                      onClick={() => void move(i, 1)}
                      aria-label="Move down"
                      className="rounded-lg border border-slate-200 p-2 text-slate-600 disabled:opacity-30"
                    >
                      <ArrowDown size={15} />
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void toggle(r)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${
                        r.enabled ? "border border-slate-200 text-slate-600" : "bg-emerald-600 text-white"
                      }`}
                    >
                      {r.enabled ? "Switch off" : "Switch on"}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => openEdit(r)}
                      className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
                    >
                      <Pencil size={13} /> Edit
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void remove(r)}
                      aria-label="Delete section"
                      className="rounded-lg border border-red-200 p-2 text-red-600 disabled:opacity-50"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}